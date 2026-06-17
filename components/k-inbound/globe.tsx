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

// 더미 항공기 글로벌 노선 (출발 lat/lng, 도착 lat/lng)
const DUMMY_ROUTES: [number, number, number, number][] = [
  [37.46, 126.44, 35.77, 140.39],  // ICN → NRT
  [51.50,  -0.12, 40.64, -73.78],  // LHR → JFK
  [33.94,-118.41, 35.67, 139.65],  // LAX → HND
  [19.07,  72.87, 48.86,   2.35],  // BOM → CDG
  [-33.94, 151.18, 1.36, 103.99],  // SYD → SIN
  [25.25,  55.37, 37.46, 126.44],  // DXB → ICN
  [52.31,   4.76, 22.31, 113.92],  // AMS → HKG
  [40.64, -73.78, 37.46, 126.44],  // JFK → ICN (한국행)
]

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
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

// 주 항공기 텍스처 — 배경 없이 ✈ 아이콘만, 흰색으로 더미와 구분
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
  const mountRef   = useRef<HTMLDivElement>(null)
  const flightRef  = useRef<FlightData | null>(null)
  const flyToRef   = useRef<((lat: number, lng: number, duration: number) => void) | null>(null)

  useImperativeHandle(ref, () => ({
    setFlight(f) { flightRef.current = f },
    flyTo(lat, lng, duration = 1200) { flyToRef.current?.(lat, lng, duration) },
  }))

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const w = mount.clientWidth, h = mount.clientHeight

    // ── 렌더러 ─────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    // 초기 카메라 — 한국(동아시아) 중심
    camera.position.copy(latLngToVec3(37, 127).multiplyScalar(2.8))

    // ── 조명 (중성 백색)
    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.9)
    frontLight.position.set(0, 0, 5)
    scene.add(frontLight)
    const pl1 = new THREE.PointLight(0xffffff, 0.6)
    pl1.position.set(-2, 3, 2); scene.add(pl1)

    // ── 지구 구체 (순수 다크, 글로우 없음)
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x080808, shininess: 20 }),
    ))

    // ── 위도/경도 격자 (선명) ───────────────────────────────────────
    const gratMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.10, transparent: true })
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

    // ── 대륙선 (Ghost War 네온 그린) ───────────────────────────────
    const landMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.35, transparent: true })
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

    // ── OrbitControls ───────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.autoRotate      = true
    controls.autoRotateSpeed = 0.2
    controls.enableDamping   = true
    controls.dampingFactor   = 0.05
    controls.minDistance     = 1.5
    controls.maxDistance     = 5
    controls.target.set(0, 0, 0)
    controls.update()

    // ── 항공 경로 Arc ───────────────────────────────────────────────
    const arcMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, opacity: 0, transparent: true })
    let arcLine: THREE.Line | null = null

    // ── 주 항공기 스프라이트 (금색 ✈) ──────────────────────────────
    const mainTex = makeMainAircraftTexture(48)
    const mainMat = new THREE.SpriteMaterial({ map: mainTex, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true })
    const mainSprite = new THREE.Sprite(mainMat)
    mainSprite.scale.set(0.07, 0.07, 1)
    scene.add(mainSprite)

    // ── 더미 항공기 ✈ 스프라이트 (8기) ────────────────────────────
    const dummyTex = makeAircraftTexture(36)
    const dummies = Array.from({ length: 8 }, (_, i) => {
      const mat = new THREE.SpriteMaterial({ map: dummyTex, transparent: true, opacity: 0.90, depthWrite: false, sizeAttenuation: true })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(0.045, 0.045, 1)
      scene.add(sprite)
      const route = DUMMY_ROUTES[i % DUMMY_ROUTES.length]
      // 각 기체를 서로 다른 진행도에서 시작
      const phaseOffset = i / 8
      const durationMs  = 3_600_000 * 4 + i * 1_200_000  // 4~6.3시간
      const startTime   = Date.now() - phaseOffset * durationMs
      return { sprite, route, startTime, durationMs }
    })

    // ── flyTo ───────────────────────────────────────────────────────
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

    // ── 애니메이션 루프 ─────────────────────────────────────────────
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
          const pts = getArcPoints(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng)
          arcLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat)
          scene.add(arcLine)
        }
        const elapsed = now - flight.fetchedAt
        const total   = flight.elapsedMs + flight.remainingMs || 1
        const t       = Math.min(flight.progressRatio + elapsed / total, 1)
        mainSprite.position.copy(
          getPointOnArc(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng, t)
        )
      } else {
        arcMat.opacity  = Math.max(arcMat.opacity - 0.01, 0)
        mainMat.opacity = Math.max(mainMat.opacity - 0.01, 0)
        if (arcLine && arcMat.opacity <= 0) { scene.remove(arcLine); arcLine = null }
      }

      // 더미 항공기 위치 업데이트
      for (const d of dummies) {
        const elapsed = now - d.startTime
        // 0.02 ~ 0.98 범위로 클램핑해서 노선 끝점 근처 z-fighting 방지
        const t = Math.max(0.02, Math.min(0.98, (elapsed % d.durationMs) / d.durationMs))
        const [f1, f2, t1, t2] = d.route
        d.sprite.position.copy(getPointOnArc(f1, f2, t1, t2, t))
      }

      renderer.render(scene, camera)
    }
    loop()

    // ── 리사이즈 ────────────────────────────────────────────────────
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
