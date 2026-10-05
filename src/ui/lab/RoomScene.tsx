import { CameraControls, Environment, Lightformer } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { finishOf } from '../../domain/materials/finishes'
import { materialById } from '../../domain/materials/catalog'
import { boardLook } from '../../domain/materials/grades'
import { PieceMesh } from '../scene/PieceMesh'
import { useDark, useReducedMotion } from '../scene/preferences'
import { useServices } from '../services'
import { conflicts, type Placed, type Size } from './room'
import { useModels, type Model } from './roomModels'
import { useRoom } from './roomStore'

// The room seen in 3D: its floor and two walls, and each placed ficha standing where it was dropped. A piece is dragged over the floor.

const MM = 0.001
const NO_SHAPES: never[] = []
const FLOOR = new Plane(new Vector3(0, 1, 0), 0)

function Piece({ item, model, bad, selected, onGrab }: { item: Placed; model: Model; bad: boolean; selected: boolean; onGrab: (e: ThreeEvent<PointerEvent>) => void }) {
  const { catalog } = useServices()
  const reduced = useReducedMotion()
  const { design, geo } = model
  const finish = finishOf(design)
  const lookOf = (material: string) => {
    const board = materialById(catalog, material)
    return board ? boardLook(board.grade, board.thickness) : boardLook('pine-plywood', 18)
  }
  const { width, depth } = design.dimensions
  return (
    <group position={[item.x * MM, 0, item.z * MM]} rotation-y={(-item.turn * Math.PI) / 180} onPointerDown={onGrab}>
      <group position={[(-width / 2) * MM, 0, (-depth / 2) * MM]}>
        {design.pieces.map((p) => (
          <PieceMesh
            key={p.id}
            piece={p}
            box={geo.boxes.get(p.id)!}
            tone={lookOf(p.material).tone}
            plies={lookOf(p.material).plies}
            offset={[0, 0, 0]}
            swing={null}
            selected={selected && !bad}
            dimmed={false}
            ghost={false}
            marked={false}
            problem={bad}
            highlight={0}
            isNew={false}
            reduced={reduced}
            delay={0}
            shapes={NO_SHAPES}
            finish={finish}
            onSelect={() => {}}
          />
        ))}
      </group>
    </group>
  )
}

/** Drags the grabbed piece over the floor: the pointer is followed on the floor's plane, not on whatever mesh is under it, and the camera holds still meanwhile. */
function useDrag(origin: [number, number], sizeOf: (code: string) => Size | undefined) {
  const { camera, gl } = useThree()
  const move = useRoom((s) => s.move)
  return (key: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const ray = new Raycaster()
    const at = new Vector3()
    const floorPoint = (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      ray.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera)
      return ray.ray.intersectPlane(FLOOR, at) ? { x: at.x / MM - origin[0], z: at.z / MM - origin[1] } : null
    }
    const item = useRoom.getState().items.find((i) => i.key === key)
    const start = floorPoint(e.nativeEvent.clientX, e.nativeEvent.clientY)
    if (!item || !start) return
    const grab = { x: item.x - start.x, z: item.z - start.z }
    useRoom.getState().select(key)
    useRoom.getState().setDragging(true)
    const onMove = (ev: PointerEvent) => {
      const p = floorPoint(ev.clientX, ev.clientY)
      if (p) move(key, { x: p.x + grab.x, z: p.z + grab.z })
    }
    const onUp = () => {
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      useRoom.getState().setDragging(false)
      useRoom.getState().settle(key, sizeOf)
    }
    addEventListener('pointermove', onMove)
    addEventListener('pointerup', onUp)
  }
}

function Contents() {
  const { room, items, selected, dragging } = useRoom()
  const models = useModels()
  const dark = useDark()
  const controls = useRef<CameraControls>(null)
  // The room is centered on the origin; this is where its corner at the back left sits, in mm.
  const origin: [number, number] = [-room.width / 2, -room.depth / 2]
  const sizeOf = (code: string) => models.get(code)?.design.dimensions
  const drag = useDrag(origin, sizeOf)
  const bad = useMemo(() => conflicts(room, items, (code) => models.get(code)?.design.dimensions), [room, items, models])
  useEffect(() => {
    void controls.current?.setLookAt(room.width * MM * 0.9, room.height * MM * 1.4, room.depth * MM * 1.6, 0, 0.4, 0, false)
  }, [room.width, room.depth, room.height])

  const wall = dark ? '#3a332c' : '#e7ddcc'
  return (
    <>
      <CameraControls ref={controls} makeDefault enabled={!dragging} minDistance={0.5} maxDistance={20} maxPolarAngle={Math.PI / 2 - 0.02} />
      <hemisphereLight args={[dark ? '#6b5f52' : '#fff6e8', dark ? '#1a1612' : '#b89a78', dark ? 0.5 : 0.8]} />
      <directionalLight position={[2.5, 4.5, 3.2]} intensity={dark ? 1.6 : 2.1} color="#fff1dc" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[6, 2, 1]} color="#fff4e2" />
      </Environment>
      <group position={[origin[0] * MM, 0, origin[1] * MM]}>
        <mesh rotation-x={-Math.PI / 2} position={[(room.width / 2) * MM, -0.001, (room.depth / 2) * MM]} onPointerDown={() => useRoom.getState().select(null)}>
          <planeGeometry args={[room.width * MM, room.depth * MM]} />
          <meshStandardMaterial color={dark ? '#2a2521' : '#efe6d6'} />
        </mesh>
        <mesh position={[(room.width / 2) * MM, (room.height / 2) * MM, -0.005]}>
          <planeGeometry args={[room.width * MM, room.height * MM]} />
          <meshStandardMaterial color={wall} />
        </mesh>
        <mesh position={[-0.005, (room.height / 2) * MM, (room.depth / 2) * MM]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[room.depth * MM, room.height * MM]} />
          <meshStandardMaterial color={wall} />
        </mesh>
        {items.map((item) => {
          const model = models.get(item.code)
          return model ? <Piece key={item.key} item={item} model={model} bad={bad.has(item.key)} selected={selected === item.key} onGrab={(e) => drag(item.key, e)} /> : null
        })}
      </group>
    </>
  )
}

export function RoomScene() {
  return (
    <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 35, near: 0.05, far: 80, position: [3, 3.5, 5] }} gl={{ antialias: true, alpha: true }}>
      <Contents />
    </Canvas>
  )
}
