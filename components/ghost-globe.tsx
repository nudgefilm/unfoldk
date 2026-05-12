"use client"

import React, { useRef, useMemo, useEffect, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import * as topojson from "topojson-client"

// world-atlas TopoJSON 응답 타입 — land 컬렉션만 사용
interface WorldAtlas {
  type: string
  objects: {
    land: topojson.GeometryObject
  }
  arcs: number[][][]
}

// 위도·경도 → 구면 좌표(3D 벡터) 변환. radius 만큼 반지름 조정 가능.
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

// 두 점 사이 great circle 호 — 중간을 살짝 띄워 부드러운 곡선. 한류 확산 표현용.
// 거리가 멀수록 호를 더 높이 띄우되 매우 절제 — 지구본 표면에 거의 붙어 화면 이탈 방지.
function createArcGeometry(
  start: THREE.Vector3,
  end: THREE.Vector3,
  segments: number,
  radius: number
): THREE.BufferGeometry {
  const startN = start.clone().normalize()
  const endN = end.clone().normalize()
  const angle = startN.angleTo(endN)
  // 가까운 도시 ≈ 2%, 지구 반대편 ≈ 8% 만 표면 위로 띄움
  const altitudeFactor = 0.02 + (angle / Math.PI) * 0.06
  const sinAngle = Math.sin(angle)

  const points: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    // 구면 선형보간(slerp) — 정확한 great circle 경로
    const a = Math.sin((1 - t) * angle) / sinAngle
    const b = Math.sin(t * angle) / sinAngle
    const interp = startN.clone().multiplyScalar(a).add(endN.clone().multiplyScalar(b))
    // 포물선 lift — 중앙에서 가장 높게
    const lift = 4 * t * (1 - t) * altitudeFactor
    points.push(interp.normalize().multiplyScalar(radius * (1 + lift)))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

// Seoul 특수 강조 마커 좌표 — 일반 도시 마커와 분리 (큰 사이즈 + 시안 색)
const SEOUL_LAT = 37.5665
const SEOUL_LON = 126.978

// 주요 세계 수도 (G20 + 핵심국). 마커 좌표용.
const WORLD_CAPITALS = [
  // Asia
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Beijing", lat: 39.90, lon: 116.41 },
  { name: "New Delhi", lat: 28.61, lon: 77.21 },
  { name: "Bangkok", lat: 13.76, lon: 100.50 },
  { name: "Jakarta", lat: -6.21, lon: 106.85 },
  { name: "Manila", lat: 14.60, lon: 120.98 },
  { name: "Hanoi", lat: 21.03, lon: 105.85 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Kuala Lumpur", lat: 3.14, lon: 101.69 },
  { name: "Taipei", lat: 25.03, lon: 121.57 },
  { name: "Ulaanbaatar", lat: 47.92, lon: 106.91 },
  { name: "Astana", lat: 51.17, lon: 71.43 },
  { name: "Dhaka", lat: 23.81, lon: 90.41 },
  { name: "Colombo", lat: 6.93, lon: 79.85 },
  // Europe
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Paris", lat: 48.86, lon: 2.35 },
  { name: "Berlin", lat: 52.52, lon: 13.41 },
  { name: "Madrid", lat: 40.42, lon: -3.70 },
  { name: "Rome", lat: 41.90, lon: 12.50 },
  { name: "Moscow", lat: 55.76, lon: 37.62 },
  { name: "Amsterdam", lat: 52.37, lon: 4.90 },
  { name: "Vienna", lat: 48.21, lon: 16.37 },
  { name: "Stockholm", lat: 59.33, lon: 18.07 },
  { name: "Oslo", lat: 59.91, lon: 10.75 },
  { name: "Copenhagen", lat: 55.68, lon: 12.57 },
  { name: "Helsinki", lat: 60.17, lon: 24.94 },
  { name: "Warsaw", lat: 52.23, lon: 21.01 },
  { name: "Prague", lat: 50.08, lon: 14.44 },
  { name: "Athens", lat: 37.98, lon: 23.73 },
  { name: "Lisbon", lat: 38.72, lon: -9.14 },
  { name: "Dublin", lat: 53.35, lon: -6.26 },
  { name: "Brussels", lat: 50.85, lon: 4.35 },
  { name: "Bern", lat: 46.95, lon: 7.45 },
  { name: "Kyiv", lat: 50.45, lon: 30.52 },
  // North America
  { name: "Washington D.C.", lat: 38.91, lon: -77.04 },
  { name: "Ottawa", lat: 45.42, lon: -75.70 },
  { name: "Mexico City", lat: 19.43, lon: -99.13 },
  { name: "Havana", lat: 23.11, lon: -82.37 },
  { name: "Panama City", lat: 8.98, lon: -79.52 },
  // South America
  { name: "Brasilia", lat: -15.79, lon: -47.88 },
  { name: "Buenos Aires", lat: -34.60, lon: -58.38 },
  { name: "Lima", lat: -12.05, lon: -77.04 },
  { name: "Bogota", lat: 4.71, lon: -74.07 },
  { name: "Santiago", lat: -33.45, lon: -70.67 },
  { name: "Caracas", lat: 10.49, lon: -66.88 },
  { name: "Quito", lat: -0.18, lon: -78.47 },
  { name: "Montevideo", lat: -34.90, lon: -56.19 },
  // Africa
  { name: "Cairo", lat: 30.04, lon: 31.24 },
  { name: "Cape Town", lat: -33.93, lon: 18.42 },
  { name: "Nairobi", lat: -1.29, lon: 36.82 },
  { name: "Lagos", lat: 6.52, lon: 3.38 },
  { name: "Casablanca", lat: 33.57, lon: -7.59 },
  { name: "Addis Ababa", lat: 9.03, lon: 38.74 },
  { name: "Accra", lat: 5.56, lon: -0.19 },
  { name: "Dakar", lat: 14.69, lon: -17.44 },
  { name: "Tunis", lat: 36.81, lon: 10.17 },
  { name: "Algiers", lat: 36.74, lon: 3.09 },
  // Oceania
  { name: "Canberra", lat: -35.28, lon: 149.13 },
  { name: "Wellington", lat: -41.29, lon: 174.78 },
  { name: "Suva", lat: -18.14, lon: 178.44 },
  // Middle East
  { name: "Dubai", lat: 25.20, lon: 55.27 },
  { name: "Riyadh", lat: 24.69, lon: 46.72 },
  { name: "Ankara", lat: 39.93, lon: 32.86 },
  { name: "Tehran", lat: 35.69, lon: 51.39 },
  { name: "Tel Aviv", lat: 32.09, lon: 34.78 },
  { name: "Doha", lat: 25.29, lon: 51.53 },
]

function WireframeGlobe() {
  const groupRef = useRef<THREE.Group>(null)
  const seoulMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const cityMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const cityPulseLastUpdate = useRef(0)
  const [landGeometry, setLandGeometry] = useState<THREE.BufferGeometry | null>(null)

  // 지구 자전축 23.5° 기울기, 지구본 반지름
  const EARTH_TILT = 23.5 * (Math.PI / 180)
  const GLOBE_RADIUS = 1.5
  // 도시 마커 펄스 갱신 주기 — 매 프레임(60fps × 80개) 대신 0.5초 단위 step 갱신
  const CITY_PULSE_INTERVAL = 0.5

  // 한류 호 — 절제된 버전: 동시 최대 3개, 5초 간격 발사
  const MAX_CONCURRENT_ARCS = 3
  const ARC_SPAWN_INTERVAL = 5
  const ARC_TRAVEL_DURATION = 1.5
  const ARC_FADE_DURATION = 0.8
  const ARC_TOTAL_DURATION = ARC_TRAVEL_DURATION + ARC_FADE_DURATION
  const ARC_SEGMENTS = 60

  // 호 슬롯 풀 — 매 프레임 useState 회피, ref 로 imperative 관리
  const arcSlots = useRef(
    Array.from({ length: MAX_CONCURRENT_ARCS }, () => ({
      active: false,
      targetIdx: 0,
      startTime: 0,
    }))
  )
  const arcLineRefs = useRef<(THREE.Line | null)[]>([])
  const arcMatRefs = useRef<(THREE.LineBasicMaterial | null)[]>([])
  // 첫 호는 페이지 진입 ~2초 후 발사 (5초 대기 시 효과 인지 전 사라짐)
  const lastArcSpawn = useRef(-3)
  // 접근성 — prefers-reduced-motion 사용자는 호 비활성
  const reducedMotion = useRef(false)

  // 매 프레임: 자전 + Seoul 펄스 + 한류 호 / 0.5초마다: 일반 도시 마커 깜빡임
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3
    }
    if (seoulMaterialRef.current) {
      // 펄스 상단 좁혀 항상 밝게 (0.75~1.0)
      const pulse = Math.sin(state.clock.elapsedTime * Math.PI) * 0.125 + 0.875
      seoulMaterialRef.current.opacity = pulse
    }
    if (state.clock.elapsedTime - cityPulseLastUpdate.current >= CITY_PULSE_INTERVAL) {
      cityPulseLastUpdate.current = state.clock.elapsedTime
      cityMaterialRefs.current.forEach((mat, i) => {
        if (mat) {
          const offset = i * 0.5
          const cityPulse = Math.sin((state.clock.elapsedTime + offset) * 1.5) * 0.35 + 0.55
          mat.opacity = cityPulse
        }
      })
    }

    // 한류 호 spawn — 5초마다 빈 슬롯에 새 호 발사 (랜덤 도시 타깃)
    if (!reducedMotion.current) {
      if (state.clock.elapsedTime - lastArcSpawn.current >= ARC_SPAWN_INTERVAL) {
        lastArcSpawn.current = state.clock.elapsedTime
        const slotIdx = arcSlots.current.findIndex(s => !s.active)
        if (slotIdx >= 0) {
          const targetIdx = Math.floor(Math.random() * WORLD_CAPITALS.length)
          arcSlots.current[slotIdx].active = true
          arcSlots.current[slotIdx].targetIdx = targetIdx
          arcSlots.current[slotIdx].startTime = state.clock.elapsedTime
          const line = arcLineRefs.current[slotIdx]
          if (line) {
            // 슬롯 동시 활성 시 drawRange 간섭 방지를 위해 clone
            line.geometry.dispose()
            line.geometry = arcGeometries[targetIdx].clone()
            line.geometry.setDrawRange(0, 0)
          }
        }
      }

      // 한류 호 update — 진행도에 따라 drawRange 확장 + opacity fade
      arcSlots.current.forEach((slot, i) => {
        if (!slot.active) return
        const line = arcLineRefs.current[i]
        const mat = arcMatRefs.current[i]
        if (!line || !mat) return
        const elapsed = state.clock.elapsedTime - slot.startTime

        if (elapsed >= ARC_TOTAL_DURATION) {
          slot.active = false
          mat.opacity = 0
          line.geometry.setDrawRange(0, 0)
          return
        }

        if (elapsed < ARC_TRAVEL_DURATION) {
          // 호가 Seoul 에서 목표 도시로 뻗어나가는 단계
          const t = elapsed / ARC_TRAVEL_DURATION
          const eased = 1 - Math.pow(1 - t, 3)
          const count = Math.max(2, Math.floor(eased * (ARC_SEGMENTS + 1)))
          line.geometry.setDrawRange(0, count)
          mat.opacity = 0.85
        } else {
          // 도달 후 fade out 단계
          line.geometry.setDrawRange(0, ARC_SEGMENTS + 1)
          const fadeT = (elapsed - ARC_TRAVEL_DURATION) / ARC_FADE_DURATION
          mat.opacity = 0.85 * (1 - fadeT)
        }
      })
    }
  })

  // 접근성 — 모션 감도 사용자는 호 발사 차단
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    reducedMotion.current = mq.matches
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Seoul→각 도시 great circle 호 geometry 사전 계산 (mount 시 1회)
  const arcGeometries = useMemo(() => {
    const seoulPos = latLonToVector3(SEOUL_LAT, SEOUL_LON, GLOBE_RADIUS)
    return WORLD_CAPITALS.map(city => {
      const targetPos = latLonToVector3(city.lat, city.lon, GLOBE_RADIUS)
      return createArcGeometry(seoulPos, targetPos, ARC_SEGMENTS, GLOBE_RADIUS)
    })
  }, [])

  // GPU 메모리 정리 — 언마운트 시 사전 계산본 + 활성 슬롯 clone 모두 dispose
  useEffect(() => {
    return () => {
      arcGeometries.forEach(g => g.dispose())
      arcLineRefs.current.forEach(line => {
        if (line) line.geometry.dispose()
      })
    }
  }, [arcGeometries])

  // CDN에서 world-atlas land 데이터 로드 → 대륙 윤곽선 지오메트리 구성
  useEffect(() => {
    async function loadWorldData() {
      try {
        const landResponse = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
        const landWorld: WorldAtlas = await landResponse.json()

        const land = topojson.feature(landWorld, landWorld.objects.land) as unknown as GeoJSON.FeatureCollection

        const points: THREE.Vector3[] = []

        const processCoordinates = (coords: number[][]) => {
          for (let i = 0; i < coords.length - 1; i++) {
            const [lon1, lat1] = coords[i]
            const [lon2, lat2] = coords[i + 1]
            points.push(latLonToVector3(lat1, lon1, GLOBE_RADIUS))
            points.push(latLonToVector3(lat2, lon2, GLOBE_RADIUS))
          }
        }

        land.features.forEach((feature: GeoJSON.Feature) => {
          if (feature.geometry.type === "Polygon") {
            feature.geometry.coordinates.forEach(ring => {
              processCoordinates(ring as number[][])
            })
          } else if (feature.geometry.type === "MultiPolygon") {
            feature.geometry.coordinates.forEach(polygon => {
              polygon.forEach(ring => {
                processCoordinates(ring as number[][])
              })
            })
          }
        })

        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        setLandGeometry(geometry)
      } catch (error) {
        console.error("Failed to load world data:", error)
      }
    }

    loadWorldData()
  }, [])

  // 위도선 7개 (적도 + ±20/40/60°)
  const latitudeLines = useMemo(() => {
    const lines: JSX.Element[] = []
    const latitudes = [-60, -40, -20, 0, 20, 40, 60]

    latitudes.forEach((lat, i) => {
      const phi = (90 - lat) * (Math.PI / 180)
      const radius = Math.sin(phi) * GLOBE_RADIUS
      const y = Math.cos(phi) * GLOBE_RADIUS

      const points: THREE.Vector3[] = []
      for (let j = 0; j <= 64; j++) {
        const theta = (j / 64) * Math.PI * 2
        points.push(new THREE.Vector3(
          Math.cos(theta) * radius,
          y,
          Math.sin(theta) * radius
        ))
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points)

      lines.push(
        <line key={`lat-${i}`} geometry={geometry}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.1} />
        </line>
      )
    })

    return lines
  }, [])

  // 경도선 12개 (30° 간격)
  const longitudeLines = useMemo(() => {
    const lines: JSX.Element[] = []
    const longitudes = 12

    for (let i = 0; i < longitudes; i++) {
      const theta = (i / longitudes) * Math.PI * 2
      const points: THREE.Vector3[] = []

      for (let j = 0; j <= 64; j++) {
        const phi = (j / 64) * Math.PI
        points.push(new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * GLOBE_RADIUS,
          Math.cos(phi) * GLOBE_RADIUS,
          Math.sin(phi) * Math.sin(theta) * GLOBE_RADIUS
        ))
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points)

      lines.push(
        <line key={`lon-${i}`} geometry={geometry}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.1} />
        </line>
      )
    }

    return lines
  }, [])

  // 도시 마커 — 표면 법선 방향으로 회전한 평면 원형 mesh
  const cityMarkers = useMemo(() => {
    return WORLD_CAPITALS.map(city => {
      const position = latLonToVector3(city.lat, city.lon, GLOBE_RADIUS + 0.01)
      const normal = position.clone().normalize()
      const quaternion = new THREE.Quaternion()
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
      return { name: city.name, position, quaternion }
    })
  }, [])

  // Seoul 강조 마커 — 일반 도시 마커 위에 살짝 띄워 z-fight 회피, 호와 동일 핑크 + 좀 더 밝은 변형
  const seoulMarker = useMemo(() => {
    const position = latLonToVector3(SEOUL_LAT, SEOUL_LON, GLOBE_RADIUS + 0.014)
    const normal = position.clone().normalize()
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    return { position, quaternion }
  }, [])

  return (
    <group rotation={[EARTH_TILT, 0, 0]}>
      <group ref={groupRef}>
        {latitudeLines}
        {longitudeLines}

        {landGeometry && (
          <lineSegments geometry={landGeometry}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.35} />
          </lineSegments>
        )}

        <mesh position={seoulMarker.position} quaternion={seoulMarker.quaternion}>
          <circleGeometry args={[0.024, 16]} />
          <meshBasicMaterial
            ref={seoulMaterialRef}
            color="#FF6B85"
            side={THREE.DoubleSide}
            transparent
            opacity={1}
          />
        </mesh>

        {/* 한류 호 — Seoul 에서 해외 도시로 5초마다 발사. brand 핑크 컬러. */}
        {Array.from({ length: MAX_CONCURRENT_ARCS }).map((_, i) => (
          <line
            key={`arc-${i}`}
            ref={el => { arcLineRefs.current[i] = el as unknown as THREE.Line | null }}
          >
            <bufferGeometry />
            <lineBasicMaterial
              ref={el => { arcMatRefs.current[i] = el }}
              color="#FF4B6E"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </line>
        ))}

        {cityMarkers.map((city, i) => (
          <mesh key={city.name} position={city.position} quaternion={city.quaternion}>
            <circleGeometry args={[0.018, 12]} />
            <meshBasicMaterial
              ref={el => { cityMaterialRefs.current[i] = el }}
              color="#FF4B6E"
              side={THREE.DoubleSide}
              transparent
              opacity={0.6}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function GhostGlobe({ className = "", size = "default" }: { className?: string; size?: "default" | "hero" }) {
  // 사이즈 옵션 — hero는 랜딩용 큰 크기, default는 일반 배치
  const sizeClasses = size === "hero"
    ? "w-[320px] h-[320px] md:w-[420px] md:h-[420px] lg:w-[500px] lg:h-[500px]"
    : "w-[160px] h-[160px] md:w-[200px] md:h-[200px]"

  // 화면 밖일 땐 렌더 루프 정지 — 스크롤 후 GPU 백그라운드 점유 방지
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "100px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className={sizeClasses}>
        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 45 }}
          style={{ background: "transparent" }}
          gl={{ alpha: true, antialias: true }}
          frameloop={isVisible ? "always" : "never"}
        >
          <WireframeGlobe />
        </Canvas>
      </div>
    </div>
  )
}
