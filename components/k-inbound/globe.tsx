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

// 세계 주요 항공 경로 12개
const MAJOR_ROUTES: { from: [number, number]; to: [number, number] }[] = [
  { from: [37.46, 126.44], to: [40.63,  -73.78] }, // ICN → JFK
  { from: [37.46, 126.44], to: [51.47,   -0.46] }, // ICN → LHR
  { from: [37.46, 126.44], to: [33.94, -118.40] }, // ICN → LAX
  { from: [35.76, 140.38], to: [40.63,  -73.78] }, // NRT → JFK
  { from: [22.30, 113.91], to: [51.47,   -0.46] }, // HKG → LHR
  { from: [25.25,  55.36], to: [51.47,   -0.46] }, // DXB → LHR
  { from: [ 1.35, 103.98], to: [51.47,   -0.46] }, // SIN → LHR
  { from: [40.63, -73.78], to: [49.00,    2.54] }, // JFK → CDG
  { from: [-33.94, 151.17], to: [1.35,  103.98] }, // SYD → SIN
  { from: [37.46, 126.44], to: [49.00,    2.54] }, // ICN → CDG
  { from: [50.03,   8.57], to: [40.63,  -73.78] }, // FRA → JFK
  { from: [13.68, 100.74], to: [37.46,  126.44] }, // BKK → ICN
]

const TRAIL_LEN   = 50
const DUMMY_COUNT = 5

interface DummyState {
  sprite:         THREE.Sprite
  mat:            THREE.SpriteMaterial
  trailLine:      THREE.Line
  trailPositions: Float32Array
  trailColors:    Float32Array
  routeIdx:       number
  t:              number
  speed:          number
  history:        THREE.Vector3[]
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

// 더미 항공기 텍스처 — 배경 없이 ✈ 아이콘만 (#FF4B6E)
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

// 주 항공기 텍스처 — 흰색으로 더미와 구분
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

    // ── 대륙선
    const landMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.75, transparent: true })
    fetch("/ne_110m_land.json")
      .then(r => r.json())
      .then((data: { features: Array<{ geometry: { type: string; coordinates: unknown } }> }) => {
        const addRing = (ring: number[][]) => {
          if (ring.length < 2) return
          const pts = ring.map(([lng, lat]) => latLngToVec3(lat, lng, GLOBE_RADIUS + 0.001))
          scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), landMat))
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

    // ── OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.autoRotate      = true
    controls.autoRotateSpeed = 0.06
    controls.enableDamping   = true
    controls.dampingFactor   = 0.05
    controls.minDistance     = 1.5
    controls.maxDistance     = 5
    controls.target.set(0, 0, 0)
    controls.update()

    // ── 실제 항공편 Arc + 주 항공기
    const arcMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, opacity: 0, transparent: true })
    let arcLine: THREE.Line | null = null

    const mainTex    = makeMainAircraftTexture(48)
    const mainMat    = new THREE.SpriteMaterial({ map: mainTex, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true })
    const mainSprite = new THREE.Sprite(mainMat)
    mainSprite.scale.set(0.07, 0.07, 1)
    scene.add(mainSprite)

    // ── 더미 항공기 5기 — 각자 랜덤 경로, 꼬리 궤적
    const dummyTex = makeAircraftTexture(36)

    const dummies: DummyState[] = Array.from({ length: DUMMY_COUNT }, () => {
      const mat    = new THREE.SpriteMaterial({ map: dummyTex, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(0.028, 0.028, 1)
      scene.add(sprite)

      // 꼬리 궤적 — vertexColors 로 앞→뒤 밝기 그라데이션
      const trailPositions = new Float32Array(TRAIL_LEN * 3)
      const trailColors    = new Float32Array(TRAIL_LEN * 3)
      const trailGeo       = new THREE.BufferGeometry()
      trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3))
      trailGeo.setAttribute("color",    new THREE.BufferAttribute(trailColors,    3))
      trailGeo.setDrawRange(0, 0)
      const trailMat  = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })
      const trailLine = new THREE.Line(trailGeo, trailMat)
      scene.add(trailLine)

      return {
        sprite,
        mat,
        trailLine,
        trailPositions,
        trailColors,
        routeIdx: Math.floor(Math.random() * MAJOR_ROUTES.length),
        t:        Math.random(),                      // 랜덤 시작 진행도
        speed:    randBetween(0.00008, 0.00016),       // 프레임당 진행 속도 (사실적 저속)
        history:  [] as THREE.Vector3[],
      }
    })

    // ── flyTo
    flyToRef.current = (lat: number, lng: number, duration: number) => {
      controls.autoRotate = false
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
        else controls.autoRotate = true
      }
      requestAnimationFrame(tick)
    }

    // ── 애니메이션 루프
    let animId: number
    const loop = () => {
      animId = requestAnimationFrame(loop)
      controls.update()

      const now    = Date.now()
      const flight = flightRef.current

      // 실제 항공편 Arc + 주 항공기
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
        mainSprite.position.copy(
          getPointOnArc(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng, ft)
        )
      } else {
        arcMat.opacity  = Math.max(arcMat.opacity - 0.01, 0)
        mainMat.opacity = Math.max(mainMat.opacity - 0.01, 0)
        if (arcLine && arcMat.opacity <= 0) { scene.remove(arcLine); arcLine = null }
      }

      // 더미 항공기 업데이트
      for (const d of dummies) {
        d.t += d.speed
        if (d.t >= 1.0) {
          // 도착 → 새 경로 랜덤 배정, 꼬리 리셋
          d.t        = 0
          d.routeIdx = Math.floor(Math.random() * MAJOR_ROUTES.length)
          d.history  = []
          ;(d.trailLine.geometry as THREE.BufferGeometry).setDrawRange(0, 0)
        }

        const { from, to } = MAJOR_ROUTES[d.routeIdx]
        const [fromLat, fromLng] = from
        const [toLat,   toLng  ] = to

        // 현재 위치
        const pos = getPointOnArc(fromLat, fromLng, toLat, toLng, d.t)
        d.sprite.position.copy(pos)

        // 진행 방향 → 카메라 공간 탄젠트 벡터로 안정적인 2D 방향 계산
        // NDC 차분 방식은 원근 왜곡으로 90° 오차 발생 가능 → 카메라 공간 접선 사용
        const tFwd    = Math.min(d.t + 0.05, 0.99)
        const posFwd  = getPointOnArc(fromLat, fromLng, toLat, toLng, tFwd)
        const tangent = posFwd.clone().sub(pos).normalize()
        tangent.transformDirection(camera.matrixWorldInverse) // 카메라 공간(X=우, Y=상)으로 변환
        const ndcZ = pos.clone().project(camera).z
        if (ndcZ < 1.0 && tangent.x * tangent.x + tangent.y * tangent.y > 1e-6) {
          const targetRot = Math.atan2(tangent.y, tangent.x) + Math.PI / 4
          // 각도 정규화 [-π, π] 후 스무딩 → 갑작스런 뒤집힘 방지
          let diff = targetRot - d.mat.rotation
          while (diff >  Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          d.mat.rotation += diff * 0.25
        }

        // 꼬리 history 갱신 — 거리 기반 샘플링 (0.002 이상 이동 시만 저장)
        // 매 프레임 저장 시 느린 속도로 인해 포인트가 밀집되어 꼬리가 짧아 보임
        const shouldSave = d.history.length === 0 ||
          pos.distanceTo(d.history[0]) > 0.002
        if (shouldSave) {
          d.history.unshift(pos.clone())
          if (d.history.length > TRAIL_LEN) d.history.pop()
        }

        // 꼬리 버퍼 업데이트 — 흰색, 앞 1.0 → 뒤 0.0 선형 그라데이션
        const n = d.history.length
        for (let j = 0; j < n; j++) {
          const p     = d.history[j]
          const alpha = n > 1 ? 1.0 - j / (n - 1) : 1.0
          d.trailPositions[j * 3]     = p.x
          d.trailPositions[j * 3 + 1] = p.y
          d.trailPositions[j * 3 + 2] = p.z
          d.trailColors[j * 3]        = alpha  // R
          d.trailColors[j * 3 + 1]    = alpha  // G
          d.trailColors[j * 3 + 2]    = alpha  // B
        }
        const trailGeo = d.trailLine.geometry as THREE.BufferGeometry
        trailGeo.setDrawRange(0, n)
        ;(trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
        ;(trailGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true
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
