"use client"

import React, { useRef, useMemo, useEffect, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import * as topojson from "topojson-client"

// world-atlas TopoJSON 응답 타입 — land/countries 두 컬렉션을 모두 다룸
interface WorldAtlas {
  type: string
  objects: {
    land: topojson.GeometryObject
    countries: topojson.GeometryCollection
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

// Natural Earth ISO 3166-1 numeric — 대한민국
const SOUTH_KOREA_ID = "410"

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
  const koreaMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const cityMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const cityPulseLastUpdate = useRef(0)
  const [landGeometry, setLandGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [koreaGeometry, setKoreaGeometry] = useState<THREE.BufferGeometry | null>(null)

  // 지구 자전축 23.5° 기울기, 지구본 반지름
  const EARTH_TILT = 23.5 * (Math.PI / 180)
  const GLOBE_RADIUS = 1.5
  // 도시 마커 펄스 갱신 주기 — 매 프레임(60fps × 80개) 대신 0.5초 단위 step 갱신
  const CITY_PULSE_INTERVAL = 0.5

  // 매 프레임: 자전 + 한국 펄스 / 0.5초마다: 도시 마커 깜빡임
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3
    }
    if (koreaMaterialRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * Math.PI) * 0.3 + 0.7
      koreaMaterialRef.current.opacity = pulse
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
  })

  // CDN에서 world-atlas 데이터 로드 → 대륙 윤곽선 + 한국 채우기 지오메트리 구성
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

        const countriesResponse = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
        const countriesWorld: WorldAtlas = await countriesResponse.json()

        const countries = topojson.feature(countriesWorld, countriesWorld.objects.countries) as unknown as GeoJSON.FeatureCollection

        const koreaFeatures = countries.features.filter((feature: GeoJSON.Feature) => {
          const id = String(feature.id)
          return id === SOUTH_KOREA_ID
        })

        if (koreaFeatures.length > 0) {
          const koreaVertices: number[] = []

          koreaFeatures.forEach((feature: GeoJSON.Feature) => {
            // 폴리곤을 fan triangulation 방식으로 채우기 — center-based
            const processPolygon = (coords: number[][]) => {
              let centerLat = 0
              let centerLon = 0
              coords.forEach(([lon, lat]) => {
                centerLat += lat
                centerLon += lon
              })
              centerLat /= coords.length
              centerLon /= coords.length

              const centerPoint = latLonToVector3(centerLat, centerLon, GLOBE_RADIUS + 0.005)

              for (let i = 0; i < coords.length - 1; i++) {
                const [lon1, lat1] = coords[i]
                const [lon2, lat2] = coords[i + 1]

                const p1 = latLonToVector3(lat1, lon1, GLOBE_RADIUS + 0.005)
                const p2 = latLonToVector3(lat2, lon2, GLOBE_RADIUS + 0.005)

                koreaVertices.push(centerPoint.x, centerPoint.y, centerPoint.z)
                koreaVertices.push(p1.x, p1.y, p1.z)
                koreaVertices.push(p2.x, p2.y, p2.z)
              }
            }

            if (feature.geometry.type === "Polygon") {
              feature.geometry.coordinates.forEach(ring => {
                processPolygon(ring as number[][])
              })
            } else if (feature.geometry.type === "MultiPolygon") {
              feature.geometry.coordinates.forEach(polygon => {
                polygon.forEach(ring => {
                  processPolygon(ring as number[][])
                })
              })
            }
          })

          const koreaGeo = new THREE.BufferGeometry()
          koreaGeo.setAttribute('position', new THREE.Float32BufferAttribute(koreaVertices, 3))
          koreaGeo.computeVertexNormals()
          setKoreaGeometry(koreaGeo)
        }
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

        {koreaGeometry && (
          <mesh geometry={koreaGeometry}>
            <meshBasicMaterial ref={koreaMaterialRef} color="#FF4B6E" side={THREE.DoubleSide} transparent opacity={0.7} />
          </mesh>
        )}

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
