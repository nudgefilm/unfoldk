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

// 더미 항공기 글로벌 노선
const DUMMY_ROUTES: [number, number, number, number][] = [
  [35.67, 139.65,  1.36, 103.99],  // Tokyo → Singapore
  [51.50,  -0.12, 40.64, -73.78],  // London → New York
  [19.07,  72.87, 48.86,   2.35],  // Mumbai → Paris
  [37.45, 126.44, 34.43, 135.24],  // ICN → KIX
  [-33.94, 151.18, -23.44, -46.47], // Sydney → São Paulo
  [33.94,-118.41, 25.25,  55.37],  // LAX → Dubai
  [52.31,   4.76, 22.31, 113.92],  // Amsterdam → Hong Kong
  [40.64, -73.78, 35.76, 140.39],  // JFK → Tokyo
]

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

function makeSpriteTexture(color: string, size: number): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = size; c.height = size
  const ctx = c.getContext("2d")!
  const half = size / 2
  const grd = ctx.createRadialGradient(half, half, 0, half, half, half * 0.85)
  grd.addColorStop(0, color)
  grd.addColorStop(0.45, color)
  grd.addColorStop(1, "transparent")
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.arc(half, half, half * 0.85, 0, Math.PI * 2)
  ctx.fill()
  return new THREE.CanvasTexture(c)
}

const KInboundGlobe = forwardRef<GlobeHandle, Props>(function KInboundGlobe({ className }, ref) {
  const mountRef = useRef<HTMLDivElement>(null)
  const flightRef = useRef<FlightData | null>(null)
  const flyToRef = useRef<((lat: number, lng: number, duration: number) => void) | null>(null)

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

    // ── 조명 (밝게 조정) ────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x334466, 0.9))
    const pl1 = new THREE.PointLight(0x5599ff, 1.1)
    pl1.position.set(-2, 3, 1); scene.add(pl1)
    const pl2 = new THREE.PointLight(0xff9900, 0.5)
    pl2.position.set(2, -2, -1); scene.add(pl2)
    // 한국 방향 보조 조명
    const kLight = new THREE.DirectionalLight(0x4488cc, 0.5)
    kLight.position.copy(latLngToVec3(37, 127)).normalize()
    scene.add(kLight)

    // ── 대기 글로우 (강화) ──────────────────────────────────────────
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.04, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x3366cc, transparent: true, opacity: 0.14, side: THREE.BackSide }),
    ))
    // 내부 글로우
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.01, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x224488, transparent: true, opacity: 0.06, side: THREE.BackSide }),
    ))

    // ── 지구 구체 ───────────────────────────────────────────────────
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x050f22, shininess: 30 }),
    ))

    // ── 위도/경도 격자 ──────────────────────────────────────────────
    const gratMat = new THREE.LineBasicMaterial({ color: 0x1e5080, opacity: 0.5, transparent: true })
    ;([-60, -30, 0, 30, 60] as number[]).forEach(lat => {
      const pts = Array.from({ length: 65 }, (_, i) => latLngToVec3(lat, (i / 64) * 360 - 180, GLOBE_RADIUS + 0.002))
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat))
    });
    ([-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180] as number[]).forEach(lng => {
      const pts = Array.from({ length: 33 }, (_, i) => latLngToVec3((i / 32) * 180 - 90, lng, GLOBE_RADIUS + 0.002))
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat))
    })

    // ── 대륙선 (밝게) ───────────────────────────────────────────────
    const landMat = new THREE.LineBasicMaterial({ color: 0x4a9eff, opacity: 0.78, transparent: true })
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
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.2
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 1.5
    controls.maxDistance = 5
    controls.target.set(0, 0, 0)
    controls.update()

    // ── 항공 경로 Arc ───────────────────────────────────────────────
    const arcMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, opacity: 0, transparent: true })
    let arcLine: THREE.Line | null = null

    // ── 주 항공기 (금색) ────────────────────────────────────────────
    const mainTex = makeSpriteTexture("#ffd700", 32)
    const mainMat = new THREE.SpriteMaterial({ map: mainTex, transparent: true, opacity: 0, depthWrite: false })
    const mainSprite = new THREE.Sprite(mainMat)
    mainSprite.scale.set(0.06, 0.06, 1)
    scene.add(mainSprite)

    // ── 더미 항공기 5기 (청색 발광점) ──────────────────────────────
    const dummyTex = makeSpriteTexture("#00bfff", 20)
    const dummies = Array.from({ length: 5 }, (_, i) => {
      const mat = new THREE.SpriteMaterial({ map: dummyTex, transparent: true, opacity: 0.85, depthWrite: false })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(0.028, 0.028, 1)
      scene.add(sprite)
      const route = DUMMY_ROUTES[i % DUMMY_ROUTES.length]
      // 각 더미를 다른 진행도에서 시작시켜 골고루 분포
      const startOffset = (i / 5) * 0.8 + 0.05 // 0.05 ~ 0.85 사이 균등 분포
      const durationMs = 3_600_000 * 5 + i * 3_600_000 // 5~9시간 간격
      const startTime = Date.now() - startOffset * durationMs
      return { sprite, route, startTime, durationMs }
    })

    // ── flyTo ───────────────────────────────────────────────────────
    flyToRef.current = (lat: number, lng: number, duration: number) => {
      controls.autoRotate = false
      const t0 = performance.now()
      const dist = camera.position.length()
      const startDir = camera.position.clone().normalize()
      const endDir = latLngToVec3(lat, lng).normalize()
      const rotQ = new THREE.Quaternion().setFromUnitVectors(startDir, endDir)
      const idQ = new THREE.Quaternion()
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
      const now = Date.now()
      const flight = flightRef.current

      if (flight) {
        arcMat.opacity = Math.min(arcMat.opacity + 0.02, 0.85)
        mainMat.opacity = Math.min(mainMat.opacity + 0.02, 1)
        if (!arcLine) {
          const pts = getArcPoints(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng)
          arcLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat)
          scene.add(arcLine)
        }
        const elapsed = now - flight.fetchedAt
        const total = flight.elapsedMs + flight.remainingMs || 1
        const t = Math.min(flight.progressRatio + elapsed / total, 1)
        mainSprite.position.copy(getPointOnArc(flight.departure.lat, flight.departure.lng, flight.arrival.lat, flight.arrival.lng, t))
      } else {
        arcMat.opacity = Math.max(arcMat.opacity - 0.01, 0)
        mainMat.opacity = Math.max(mainMat.opacity - 0.01, 0)
        if (arcLine && arcMat.opacity <= 0) { scene.remove(arcLine); arcLine = null }
      }

      // 더미 항공기 위치 업데이트
      for (const d of dummies) {
        const elapsed = now - d.startTime
        const t = (elapsed % d.durationMs) / d.durationMs
        const [f1, f2, t1, t2] = d.route
        // 글로브 표면 위 소폭 띄워서 z-fighting 방지
        const raw = getPointOnArc(f1, f2, t1, t2, Math.max(0.01, Math.min(0.99, t)))
        d.sprite.position.copy(raw)
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
