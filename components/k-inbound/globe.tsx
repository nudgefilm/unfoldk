"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { getArcPoints, getPointOnArc, latLngToVec3, GLOBE_RADIUS } from "./route-arc"
import type { FlightData } from "@/app/api/k-inbound/flight/route"

export interface GlobeHandle {
  setFlight: (flight: FlightData | null) => void
  flyTo: (lat: number, lng: number, duration?: number) => void
}

interface Props { className?: string }

// 세계 주요 항공 경로 12개 + 실제 비행시간(ms)
const MAJOR_ROUTES: { from: [number, number]; to: [number, number]; duration: number }[] = [
  { from: [37.46, 126.44], to: [40.63,  -73.78], duration: 14 * 3600000 }, // ICN → JFK
  { from: [37.46, 126.44], to: [51.47,   -0.46], duration: 12 * 3600000 }, // ICN → LHR
  { from: [37.46, 126.44], to: [33.94, -118.40], duration: 11 * 3600000 }, // ICN → LAX
  { from: [35.76, 140.38], to: [40.63,  -73.78], duration: 14 * 3600000 }, // NRT → JFK
  { from: [22.30, 113.91], to: [51.47,   -0.46], duration: 13 * 3600000 }, // HKG → LHR
  { from: [25.25,  55.36], to: [51.47,   -0.46], duration:  7 * 3600000 }, // DXB → LHR
  { from: [ 1.35, 103.98], to: [51.47,   -0.46], duration: 13 * 3600000 }, // SIN → LHR
  { from: [40.63, -73.78], to: [49.00,    2.54], duration:  7 * 3600000 }, // JFK → CDG
  { from: [-33.94, 151.17], to: [1.35,  103.98], duration:  8 * 3600000 }, // SYD → SIN
  { from: [37.46, 126.44], to: [49.00,    2.54], duration: 12 * 3600000 }, // ICN → CDG
  { from: [50.03,   8.57], to: [40.63,  -73.78], duration:  9 * 3600000 }, // FRA → JFK
  { from: [13.68, 100.74], to: [37.46,  126.44], duration:  5 * 3600000 }, // BKK → ICN
]

const TRAIL_LEN   = 50
const DUMMY_COUNT = 5
const AIRCRAFT_ROTATION_OFFSET = Math.PI / 2 // 조정 필요: 0 → Math.PI/4 → -Math.PI/4 순으로 테스트

// 지구 자전 속도: 5분/회전 (실제 24시간은 시각적으로 멈춘 것처럼 보임)
const EARTH_ROT_RAD_PER_SEC = (Math.PI * 2) / 1200

// trail 샘플링 간격: 1분마다 1점 (TRAIL_LEN 50 → 경로의 ~6% 이내)
const TRAIL_SAVE_INTERVAL_MS = 60_000

interface DummyState {
  sprite:           THREE.Sprite
  mat:              THREE.SpriteMaterial
  trailLine:        THREE.Line
  trailPositions:   Float32Array
  trailColors:      Float32Array
  routeIdx:         number
  startTime:        number        // 출발 기준 ms timestamp
  lastTrailSaveMs:  number        // 마지막 trail point 저장 시각
  history:          THREE.Vector3[]
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

function makeAircraftTexture(size: number): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = size; c.height = size
  const ctx = c.getContext("2d")!
  ctx.font = `bold ${Math.round(size * 0.72)}px Arial, sans-serif`
  ctx.fillStyle = "#FF4B6E"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("✈", size / 2, size / 2)
  return new THREE.CanvasTexture(c)
}

function makeMainAircraftTexture(size: number): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = size; c.height = size
  const ctx = c.getContext("2d")!
  ctx.font = `bold ${Math.round(size * 0.72)}px Arial, sans-serif`
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("✈", size / 2, size / 2)
  return new THREE.CanvasTexture(c)
}

const KInboundGlobe = forwardRef<GlobeHandle, Props>(function KInboundGlobe({ className }, ref) {
  const mountRef  = useRef<HTMLDivElement>(null)
  const flightRef = useRef<FlightData | null>(null)
  const flyToRef  = useRef<((lat: number, lng: number, duration: number) => void) | null>(null)

  useImperativeHandle(ref, () => ({
    setFlight(f) { flightRef.current = f },
    flyTo(lat, lng, duration = 1200) { flyToRef.current?.(lat, lng, duration) },
  }))

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w = mount.clientWidth, h = mount.clientHeight

    // ── 렌더러
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.copy(latLngToVec3(37, 127).multiplyScalar(2.8))

    // ── 위도/경도 격자
    const gratMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.12, transparent: true })
    ;([-60, -30, 0, 30, 60] as number[]).forEach(lat => {
      const pts = Array.from({ length: 65 }, (_, i) =>
        latLngToVec3(lat, (i / 64) * 360 - 180, GLOBE_RADIUS + 0.002))
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat))
    });
    ([-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180] as number[]).forEach(lng => {
      const pts = Array.from({ length: 33 }, (_, i) =>
        latLngToVec3((i / 32) * 180 - 90, lng, GLOBE_RADIUS + 0.002))
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat))
    })

    // ── 대륙선 — 카메라 기준 앞면/뒷면 brightness 매 프레임 갱신
    const landLineData: Array<{ colAttr: THREE.BufferAttribute; positions: Float32Array }> = []
    fetch("/ne_110m_land.json")
      .then(r => r.json())
      .then((data: { features: Array<{ geometry: { type: string; coordinates: unknown } }> }) => {
        const addRing = (ring: number[][]) => {
          if (ring.length < 2) return
          const pts = ring.map(([lng, lat]) => latLngToVec3(lat, lng, GLOBE_RADIUS + 0.001))
          const n   = pts.length
          const positions = new Float32Array(n * 3)
          const colors    = new Float32Array(n * 3).fill(0.75)
          for (let i = 0; i < n; i++) {
            positions[i * 3]     = pts[i].x
            positions[i * 3 + 1] = pts[i].y
            positions[i * 3 + 2] = pts[i].z
          }
          const geo     = new THREE.BufferGeometry()
          const colAttr = new THREE.BufferAttribute(colors, 3)
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
          geo.setAttribute("color",    colAttr)
          const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false })
          scene.add(new THREE.Line(geo, mat))
          landLineData.push({ colAttr, positions })
        }
        for (const { geometry } of data.features) {
          if (geometry.type === "Polygon") {
            (geometry.coordinates as number[][][]).forEach(addRing)
          } else if (geometry.type === "MultiPolygon") {
            (geometry.coordinates as number[][][][]).forEach(poly => poly.forEach(addRing))
          }
        }
      })
      .catch(() => {})

    // ── OrbitControls — autoRotate OFF, Clock 기반 지구 자전 적용
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.autoRotate  = false
    controls.enableDamping  = true
    controls.dampingFactor  = 0.05
    controls.minDistance    = 1.5
    controls.maxDistance    = 5
    controls.target.set(0, 0, 0)
    controls.update()

    // Clock 기반 실시간 자전 (flyTo 중 일시정지 플래그)
    const clock   = new THREE.Clock()
    const yAxis   = new THREE.Vector3(0, 1, 0)
    const autoRot = { enabled: true }

    // ── 실제 항공편 Arc + 주 항공기
    const arcMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, opacity: 0, transparent: true })
    let arcLine: THREE.Line | null = null

    const mainTex    = makeMainAircraftTexture(48)
    const mainMat    = new THREE.SpriteMaterial({ map: mainTex, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true })
    const mainSprite = new THREE.Sprite(mainMat)
    mainSprite.scale.set(0.0504, 0.0504, 1)
    scene.add(mainSprite)

    // ── 더미 항공기 5기 — 실제 비행시간 기준 speed
    const dummyTex = makeAircraftTexture(36)
    const nowInit  = Date.now()

    const dummies: DummyState[] = Array.from({ length: DUMMY_COUNT }, () => {
      const mat    = new THREE.SpriteMaterial({ map: dummyTex, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(0.0336, 0.0336, 1)
      scene.add(sprite)

      const trailPositions = new Float32Array(TRAIL_LEN * 3)
      const trailColors    = new Float32Array(TRAIL_LEN * 3)
      const trailGeo       = new THREE.BufferGeometry()
      trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3))
      trailGeo.setAttribute("color",    new THREE.BufferAttribute(trailColors,    3))
      trailGeo.setDrawRange(0, 0)
      const trailMat  = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })
      const trailLine = new THREE.Line(trailGeo, trailMat)
      scene.add(trailLine)

      const routeIdx  = Math.floor(Math.random() * MAJOR_ROUTES.length)
      const route     = MAJOR_ROUTES[routeIdx]
      const startTime = nowInit - Math.random() * route.duration
      const curProg   = Math.min((nowInit - startTime) / route.duration, 1.0)
      const [fromLat, fromLng] = route.from
      const [toLat,   toLng  ] = route.to

      // trail 초기화: 비행기보다 0.003 뒤에서 시작 (겹침 방지), 최대 30% 범위
      const TRAIL_GAP  = 0.003
      const trailStart = Math.max(0, curProg - TRAIL_GAP)
      const trailSpan  = Math.min(trailStart, 0.30)
      const history: THREE.Vector3[] = []
      for (let i = 0; i < TRAIL_LEN; i++) {
        const t = trailStart - (i / TRAIL_LEN) * trailSpan
        if (t < 0) break
        history.push(getPointOnArc(fromLat, fromLng, toLat, toLng, t))
      }

      return { sprite, mat, trailLine, trailPositions, trailColors, routeIdx, startTime, lastTrailSaveMs: nowInit, history }
    })

    // ── flyTo
    flyToRef.current = (lat: number, lng: number, duration: number) => {
      autoRot.enabled = false
      const t0       = performance.now()
      const dist     = camera.position.length()
      const startDir = camera.position.clone().normalize()
      const endDir   = latLngToVec3(lat, lng).normalize()
      const rotQ     = new THREE.Quaternion().setFromUnitVectors(startDir, endDir)
      const idQ      = new THREE.Quaternion()
      const tick = (now: number) => {
        const t = Math.min((now - t0) / duration, 1)
        const q = idQ.clone().slerp(rotQ, easeInOutCubic(t))
        camera.position.copy(startDir.clone().applyQuaternion(q).multiplyScalar(dist))
        if (t < 1) requestAnimationFrame(tick)
        else autoRot.enabled = true
      }
      requestAnimationFrame(tick)
    }

    // ── 애니메이션 루프
    let animId: number
    const loop = () => {
      animId = requestAnimationFrame(loop)

      // 지구 자전 — Clock.getDelta() 기반 실제 자전 속도 (24시간/회전)
      const frameDelta = Math.min(clock.getDelta(), 0.1) // 최대 100ms 클램프
      if (autoRot.enabled) {
        camera.position.applyAxisAngle(yAxis, -EARTH_ROT_RAD_PER_SEC * frameDelta)
      }
      controls.update()

      const now    = Date.now()
      const flight = flightRef.current

      // 실제 항공편 — fetchedAt 기준 progressRatio + 경과 시간 보정으로 현재 위치 추정
      if (flight) {
        arcMat.opacity  = Math.min(arcMat.opacity + 0.02, 0.85)
        mainMat.opacity = Math.min(mainMat.opacity + 0.02, 1)
        if (!arcLine) {
          const pts = getArcPoints(
            flight.departure.lat, flight.departure.lng,
            flight.arrival.lat,   flight.arrival.lng,
          )
          arcLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat)
          scene.add(arcLine)
        }
        const elapsed = now - flight.fetchedAt
        const total   = flight.elapsedMs + flight.remainingMs || 1
        const ft      = Math.min(flight.progressRatio + elapsed / total, 1)
        const mainPos  = getPointOnArc(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng, ft)
        mainSprite.position.copy(mainPos)
        // 진행 방향 → 카메라 공간 탄젠트 + 우로 45° 오프셋
        const ftFwd     = Math.min(ft + 0.05, 0.99)
        const mainPosFwd = getPointOnArc(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng, ftFwd)
        const mainTangent = mainPosFwd.clone().sub(mainPos).normalize()
        mainTangent.transformDirection(camera.matrixWorldInverse)
        const mainNdcZ = mainPos.clone().project(camera).z
        if (mainNdcZ < 1.0 && mainTangent.x * mainTangent.x + mainTangent.y * mainTangent.y > 1e-6) {
          const targetRot = Math.atan2(mainTangent.y, mainTangent.x) + AIRCRAFT_ROTATION_OFFSET
          let diff = targetRot - mainMat.rotation
          while (diff >  Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          mainMat.rotation += diff * 0.25
        }
      } else {
        arcMat.opacity  = Math.max(arcMat.opacity - 0.01, 0)
        mainMat.opacity = Math.max(mainMat.opacity - 0.01, 0)
        if (arcLine && arcMat.opacity <= 0) { scene.remove(arcLine); arcLine = null }
      }

      // 더미 항공기 — progress = (now - startTime) / route.duration
      for (const d of dummies) {
        const route    = MAJOR_ROUTES[d.routeIdx]
        const progress = (now - d.startTime) / route.duration

        if (progress >= 1.0) {
          d.routeIdx         = Math.floor(Math.random() * MAJOR_ROUTES.length)
          d.startTime        = now
          d.lastTrailSaveMs  = now
          d.history          = []
          ;(d.trailLine.geometry as THREE.BufferGeometry).setDrawRange(0, 0)
          continue
        }

        const { from, to } = route
        const [fromLat, fromLng] = from
        const [toLat,   toLng  ] = to

        const pos = getPointOnArc(fromLat, fromLng, toLat, toLng, progress)
        d.sprite.position.copy(pos)

        // 방향 — 카메라 공간 탄젠트 벡터 + 스무딩
        const tFwd    = Math.min(progress + 0.05, 0.99)
        const posFwd  = getPointOnArc(fromLat, fromLng, toLat, toLng, tFwd)
        const tangent = posFwd.clone().sub(pos).normalize()
        tangent.transformDirection(camera.matrixWorldInverse)
        const ndcZ = pos.clone().project(camera).z
        if (ndcZ < 1.0 && tangent.x * tangent.x + tangent.y * tangent.y > 1e-6) {
          const targetRot = Math.atan2(tangent.y, tangent.x)
          let diff = targetRot - d.mat.rotation
          while (diff >  Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          d.mat.rotation += diff * 0.25
        }

        // 꼬리 — 시간 기반 샘플링 (실제 비행시간에서 거리 기반은 점 미적립 문제)
        const shouldSave = d.history.length === 0 || (now - d.lastTrailSaveMs) >= TRAIL_SAVE_INTERVAL_MS
        if (shouldSave) {
          d.lastTrailSaveMs = now
          // 비행기 현재 위치보다 0.003 뒤 지점 저장 (비행기와 trail 간격 유지)
          const behindPos = getPointOnArc(fromLat, fromLng, toLat, toLng, Math.max(0, progress - 0.003))
          d.history.unshift(behindPos)
          if (d.history.length > TRAIL_LEN) d.history.pop()
        }

        // 꼬리 버퍼 — 흰색, 앞 1.0 → 뒤 0.0 선형
        const n = d.history.length
        for (let j = 0; j < n; j++) {
          const p     = d.history[j]
          const alpha = n > 1 ? 1.0 - j / (n - 1) : 1.0
          d.trailPositions[j * 3]     = p.x
          d.trailPositions[j * 3 + 1] = p.y
          d.trailPositions[j * 3 + 2] = p.z
          d.trailColors[j * 3]        = alpha
          d.trailColors[j * 3 + 1]    = alpha
          d.trailColors[j * 3 + 2]    = alpha
        }
        const trailGeo = d.trailLine.geometry as THREE.BufferGeometry
        trailGeo.setDrawRange(0, n)
        ;(trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
        ;(trailGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true
      }

      // 대륙선 앞면/뒷면 brightness — 카메라 방향과 버텍스 내적으로 매 프레임 갱신
      const camDir = camera.position.clone().normalize()
      for (const { colAttr, positions } of landLineData) {
        const count = colAttr.count
        for (let i = 0; i < count; i++) {
          const vx = positions[i * 3], vy = positions[i * 3 + 1], vz = positions[i * 3 + 2]
          const len = Math.sqrt(vx * vx + vy * vy + vz * vz)
          const dot = (vx * camDir.x + vy * camDir.y + vz * camDir.z) / len
          // dot  1=정면(밝게)  0=가장자리(중간)  -1=뒷면(어둡게)
          const b = dot > 0 ? 0.3 + dot * 0.45 : 0.3 + dot * 0.25
          colAttr.setXYZ(i, b, b, b)
        }
        colAttr.needsUpdate = true
      }

      renderer.render(scene, camera)
    }
    loop()

    // ── 리사이즈
    const onResize = () => {
      const w2 = mount.clientWidth, h2 = mount.clientHeight
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
      renderer.setSize(w2, h2)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", onResize)
      controls.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className={className ?? "w-full h-full"} />
})

export default KInboundGlobe
