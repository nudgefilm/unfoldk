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

const TRAIL_LEN             = 50
const DUMMY_COUNT           = 5
const EARTH_ROT_RAD_PER_SEC = (Math.PI * 2) / 1200
const TRAIL_SAVE_INTERVAL_MS = 60_000

// 비행기 앞방향 명시적 정의: Three.js Shape 로컬 +X축 = 기수
const AIRCRAFT_FORWARD = new THREE.Vector3(1, 0, 0)

interface DummyState {
  mesh:            THREE.Mesh
  mat:             THREE.MeshBasicMaterial
  trailLine:       THREE.Line
  trailPositions:  Float32Array
  trailColors:     Float32Array
  routeIdx:        number
  startTime:       number
  lastTrailSaveMs: number
  history:         THREE.Vector3[]
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

// Three.js Shape으로 비행기 실루엣 생성 (XY 평면)
// 기수: +X(AIRCRAFT_FORWARD), 날개: ±Y, 꼬리: -X
// 정규화 길이 1.0 [-0.5, +0.5] — mesh.scale로 실 크기 조절
function makeAircraftShape(): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo( 0.50,  0.00)   // 기수 끝 (+X)
  s.lineTo( 0.00,  0.06)   // 동체 상단 앞
  s.lineTo( 0.05,  0.06)
  s.lineTo(-0.10,  0.38)   // 주익 끝
  s.lineTo(-0.20,  0.08)   // 주익 후연
  s.lineTo(-0.38,  0.06)   // 동체 후미 상단
  s.lineTo(-0.42,  0.18)   // 꼬리날개 끝
  s.lineTo(-0.50,  0.04)   // 꼬리 후연
  s.lineTo(-0.50,  0.00)   // 꼬리 중심선 (-X)
  s.lineTo(-0.50, -0.04)
  s.lineTo(-0.42, -0.18)
  s.lineTo(-0.38, -0.06)
  s.lineTo(-0.20, -0.08)
  s.lineTo(-0.10, -0.38)
  s.lineTo( 0.05, -0.06)
  s.lineTo( 0.00, -0.06)
  s.lineTo( 0.50,  0.00)
  return s
}

// 구 표면 위 비행기 Quaternion 계산
// AIRCRAFT_FORWARD(로컬 +X) → 진행방향, 로컬 +Z → 구 외향 법선
// 우수 기저: X=forward, Y=normal×forward, Z=normal
function calcAircraftQuaternion(pos: THREE.Vector3, nextPos: THREE.Vector3): THREE.Quaternion | null {
  // AIRCRAFT_FORWARD 방향(로컬 +X)을 world forward로 정렬할 회전 계산
  const forward = nextPos.clone().sub(pos)
  if (forward.lengthSq() < 1e-10) return null
  forward.normalize()
  const normal = pos.clone().normalize()                                     // 구 외향 법선 (로컬 +Z 대응)
  const left   = new THREE.Vector3().crossVectors(normal, forward)           // 우수 기저 Y축
  if (left.lengthSq() < 1e-8) return null
  left.normalize()
  // makeBasis(xWorld, yWorld, zWorld): 로컬 X→forward, Y→left, Z→normal
  const m = new THREE.Matrix4().makeBasis(forward, left, normal)
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

const KInboundGlobe = forwardRef<GlobeHandle, Props>(function KInboundGlobe({ className }, ref) {
  const mountRef  = useRef<HTMLDivElement>(null)
  const flightRef = useRef<FlightData | null>(null)
  const flyToRef  = useRef<((lat: number, lng: number, duration: number) => void) | null>(null)

  useImperativeHandle(ref, () => ({
    setFlight(f) {
      flightRef.current = f
      if (f && flyToRef.current) {
        const elapsed = Date.now() - f.fetchedAt
        const total   = f.elapsedMs + f.remainingMs || 1
        const ft      = Math.min(f.progressRatio + elapsed / total, 1)
        const pos     = getPointOnArc(
          f.departure.lat, f.departure.lng,
          f.arrival.lat,   f.arrival.lng,
          ft,
        )
        const r   = pos.length()
        const lat = 90 - Math.acos(Math.max(-1, Math.min(1, pos.y / r))) * (180 / Math.PI)
        const lng = Math.atan2(pos.z, -pos.x) * (180 / Math.PI) - 180
        flyToRef.current(lat, lng, 1500)
      }
    },
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

    // ── OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.autoRotate  = false
    controls.enableDamping  = true
    controls.dampingFactor  = 0.05
    controls.minDistance    = 1.5
    controls.maxDistance    = 5
    controls.target.set(0, 0, 0)
    controls.update()

    const clock   = new THREE.Clock()
    const yAxis   = new THREE.Vector3(0, 1, 0)
    const autoRot = { enabled: true }

    // ── 실제 항공편 Arc + 주 항공기 Mesh (#FF4B6E)
    const arcMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, opacity: 0, transparent: true })
    let arcLine: THREE.Line | null = null

    const aircraftShape = makeAircraftShape()
    const mainGeo  = new THREE.ShapeGeometry(aircraftShape)
    const mainMat  = new THREE.MeshBasicMaterial({ color: 0xFF4B6E, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false })
    const mainMesh = new THREE.Mesh(mainGeo, mainMat)
    mainMesh.scale.setScalar(0.0504)
    scene.add(mainMesh)

    // ── 더미 항공기 5기 (#ffffff) — 공유 Geometry
    const dummyGeo = new THREE.ShapeGeometry(aircraftShape)
    const nowInit  = Date.now()

    const dummies: DummyState[] = Array.from({ length: DUMMY_COUNT }, () => {
      const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })
      const mesh = new THREE.Mesh(dummyGeo, mat)
      mesh.scale.setScalar(0.0336)
      scene.add(mesh)

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

      const TRAIL_GAP  = 0.003
      const trailStart = Math.max(0, curProg - TRAIL_GAP)
      const trailSpan  = Math.min(trailStart, 0.30)
      const history: THREE.Vector3[] = []
      for (let i = 0; i < TRAIL_LEN; i++) {
        const t = trailStart - (i / TRAIL_LEN) * trailSpan
        if (t < 0) break
        history.push(getPointOnArc(fromLat, fromLng, toLat, toLng, t))
      }

      return { mesh, mat, trailLine, trailPositions, trailColors, routeIdx, startTime, lastTrailSaveMs: nowInit, history }
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

      const frameDelta = Math.min(clock.getDelta(), 0.1)
      if (autoRot.enabled) {
        camera.position.applyAxisAngle(yAxis, -EARTH_ROT_RAD_PER_SEC * frameDelta)
      }
      controls.update()

      const now    = Date.now()
      const flight = flightRef.current

      // 실제 항공편
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
        const elapsed    = now - flight.fetchedAt
        const total      = flight.elapsedMs + flight.remainingMs || 1
        const ft         = Math.min(flight.progressRatio + elapsed / total, 1)
        const mainPos    = getPointOnArc(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng, ft)
        const mainNextPos = getPointOnArc(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng, Math.min(ft + 0.01, 0.99))

        mainMesh.position.copy(mainPos)
        // AIRCRAFT_FORWARD(+X)를 진행방향으로 정렬하는 Quaternion 적용
        const mainQ = calcAircraftQuaternion(mainPos, mainNextPos)
        if (mainQ) mainMesh.quaternion.copy(mainQ)
      } else {
        arcMat.opacity  = Math.max(arcMat.opacity - 0.01, 0)
        mainMat.opacity = Math.max(mainMat.opacity - 0.01, 0)
        if (arcLine && arcMat.opacity <= 0) { scene.remove(arcLine); arcLine = null }
      }

      // 더미 항공기
      for (const d of dummies) {
        const route    = MAJOR_ROUTES[d.routeIdx]
        const progress = (now - d.startTime) / route.duration

        if (progress >= 1.0) {
          d.routeIdx        = Math.floor(Math.random() * MAJOR_ROUTES.length)
          d.startTime       = now
          d.lastTrailSaveMs = now
          d.history         = []
          ;(d.trailLine.geometry as THREE.BufferGeometry).setDrawRange(0, 0)
          continue
        }

        const { from, to } = route
        const [fromLat, fromLng] = from
        const [toLat,   toLng  ] = to

        const pos     = getPointOnArc(fromLat, fromLng, toLat, toLng, progress)
        const nextPos = getPointOnArc(fromLat, fromLng, toLat, toLng, Math.min(progress + 0.01, 0.99))

        d.mesh.position.copy(pos)
        // AIRCRAFT_FORWARD(+X)를 진행방향으로 정렬하는 Quaternion 적용
        const q = calcAircraftQuaternion(pos, nextPos)
        if (q) d.mesh.quaternion.copy(q)

        // 꼬리 궤적 — 비행기 뒤쪽(-X 연결점) 기준 시간 샘플링
        const shouldSave = d.history.length === 0 || (now - d.lastTrailSaveMs) >= TRAIL_SAVE_INTERVAL_MS
        if (shouldSave) {
          d.lastTrailSaveMs = now
          // 비행기 후미(-X) 에 연결: progress 보다 약간 뒤 지점 저장
          const behindPos = getPointOnArc(fromLat, fromLng, toLat, toLng, Math.max(0, progress - 0.003))
          d.history.unshift(behindPos)
          if (d.history.length > TRAIL_LEN) d.history.pop()
        }

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

      // 대륙선 앞면/뒷면 brightness
      const camDir = camera.position.clone().normalize()
      for (const { colAttr, positions } of landLineData) {
        const count = colAttr.count
        for (let i = 0; i < count; i++) {
          const vx = positions[i * 3], vy = positions[i * 3 + 1], vz = positions[i * 3 + 2]
          const len = Math.sqrt(vx * vx + vy * vy + vz * vz)
          const dot = (vx * camDir.x + vy * camDir.y + vz * camDir.z) / len
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
      mainGeo.dispose()
      mainMat.dispose()
      dummyGeo.dispose()
      dummies.forEach(d => { d.mat.dispose(); d.trailLine.geometry.dispose() })
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className={className ?? "w-full h-full"} />
})

export default KInboundGlobe
