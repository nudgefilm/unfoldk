import * as THREE from "three"

export const GLOBE_RADIUS = 1

export function latLngToVec3(lat: number, lng: number, r = GLOBE_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

/** 대권항로 위 numPoints개 점 배열 반환 */
export function getArcPoints(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  numPoints = 120,
  arcHeight = 0.07,
): THREE.Vector3[] {
  const startNorm = latLngToVec3(fromLat, fromLng).normalize()
  const endNorm   = latLngToVec3(toLat,   toLng).normalize()
  return Array.from({ length: numPoints + 1 }, (_, i) => {
    const t = i / numPoints
    const slerped = startNorm.clone().lerp(endNorm, t)
    if (slerped.lengthSq() < 1e-8) {
      return startNorm.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
        .multiplyScalar(GLOBE_RADIUS + arcHeight)
    }
    slerped.normalize()
    const arc = Math.sin(Math.PI * t) * arcHeight
    return slerped.multiplyScalar(GLOBE_RADIUS + arc)
  })
}

/** 진행도 t (0~1) 에서의 대권항로 위 위치 */
export function getPointOnArc(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  t: number,
  arcHeight = 0.07,
): THREE.Vector3 {
  const tt = Math.max(0, Math.min(1, t))
  const startNorm = latLngToVec3(fromLat, fromLng).normalize()
  const endNorm   = latLngToVec3(toLat,   toLng).normalize()
  const slerped = startNorm.clone().lerp(endNorm, tt)
  if (slerped.lengthSq() < 1e-8) {
    return startNorm.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
      .multiplyScalar(GLOBE_RADIUS + arcHeight)
  }
  slerped.normalize()
  const arc = Math.sin(Math.PI * tt) * arcHeight
  return slerped.multiplyScalar(GLOBE_RADIUS + arc)
}

/** 두 공항 사이 방향 벡터 (항공기 오리엔테이션용) */
export function getDirectionAtT(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  t: number,
  arcHeight = 0.07,
): THREE.Vector3 {
  const dt = 0.005
  const p0 = getPointOnArc(fromLat, fromLng, toLat, toLng, Math.max(0, t - dt), arcHeight)
  const p1 = getPointOnArc(fromLat, fromLng, toLat, toLng, Math.min(1, t + dt), arcHeight)
  return p1.clone().sub(p0).normalize()
}
