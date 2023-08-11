import * as THREE from 'three';
import * as React from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

/*
Idea: represent the group as
generated by the 6 permutations on 27 cubelets.
Each cubelet is referenced as a string "ijk"
and a permutation as a dictionary
*/

type Perm = { [key: string]: string }

function cycle(ns: any[]): Perm {
  const o: Perm = {}
  for (let i = 0; i < ns.length; i++) {
    o[ns[i]] = ns[(i + 1) % ns.length]
  }
  return o
}

function apply(p: Perm, k: string) {
  return p[k] ?? k
}

function compose(p1: Perm, p2: Perm) {
  const o: Perm = { ...p2 }
  for (const k1 in p1) {
    o[k1] = apply(p2, p1[k1])
  }
  return o
}

function invert(p: Perm): Perm {
  const o: Perm = {}
  for (const k in p) {
    o[p[k]] = k
  }
  return o
}

const colors = ['red', 'snow', 'darkorange', 'yellow', 'green', 'blue']


// action of 90° rotation on 3×3 grid
const R2 = compose(
  cycle(["00", "20", "22", "02"]),
  cycle(["01", "10", "21", "12"])
)

/** Converts a permutation on a 2D grid to a permutation
 * on a 3D cube by adding an extra axis to the permutation values.
 *
 * ### Parameters
 * - `p2d : Perm` is the 2D permutation
 * - `newaxis : number` is the axis to introduce. That is, `0` is the X-axis, `1` is the Y-axis, and `2` is the Z-axis.
 * - `axisvals : string[]` are the values to insert at `newaxis`.  So for example `inject(R2, 1, ["0","1","2"])` corresponds to rotating
 *   the entire Rubik's cube around the Y-axis.
 *   `inject(R2, 1, ["0"])` rotates just the top layer around the Y-axis.
 *
 * ### Example:
 * ```ts
 * inject(cycle(["00", "20", "22", "02"]), 1, [1])
 *   ≡ cycle(["010", "210", "212", "012"])
 *
 * inject(cycle(["00", "20", "22", "02"]), 0, [1])
 *   ≡ cycle(["100", "120", "122", "102"])
 * ```
 */
function inject(p2d: Perm, newaxis: number, axisvals: string[]) {
  function ins(x: string, v: string) {
    const xs = x.split("")
    xs.splice(newaxis, 0, v)
    return xs.join("")
  }
  const o: Perm = {}
  for (const k2d in p2d) {
    const v2d = p2d[k2d]
    for (const v of axisvals) {
      o[ins(k2d, v)] = ins(v2d, v)
    }
  }
  return o
}

type genstr =
  | "U" | "D" | "L" | "R" | "F" | "B"
  | "U⁻¹" | "D⁻¹" | "L⁻¹" | "R⁻¹" | "F⁻¹" | "B⁻¹"

const generators: { [k in genstr]: Perm } = {
  U: inject(R2, 0, ["2"]),
  D: inject(R2, 0, ["0"]),
  L: inject(R2, 1, ["2"]),
  R: inject(R2, 1, ["0"]),
  F: inject(R2, 2, ["2"]),
  B: inject(R2, 2, ["0"]),
} as any

for (const k of Object.getOwnPropertyNames(generators)) {
  // @ts-ignore
  generators[`${k}⁻¹`] = invert(generators[k])
}

function generatorToRotation(generator: string, cubelet: string, time = 1.0): THREE.Matrix4 {
  if (generator.includes("⁻¹")) {
    return generatorToRotation(generator.split("⁻¹")[0], cubelet, time).invert()
  }
  const θ = Math.PI * 0.5 * time
  if (generator == "U" && cubelet[0] == "2") {
    return new THREE.Matrix4().makeRotationX(θ)
  }
  if (generator == "D" && cubelet[0] == "0") {
    return new THREE.Matrix4().makeRotationX(θ)
  }
  if (generator == "L" && cubelet[1] == "2") {
    return new THREE.Matrix4().makeRotationY(- θ)
  }
  if (generator == "R" && cubelet[1] == "0") {
    return new THREE.Matrix4().makeRotationY(- θ)
  }
  if (generator == "F" && cubelet[2] == "2") {
    return new THREE.Matrix4().makeRotationZ(θ)
  }
  if (generator == "B" && cubelet[2] == "0") {
    return new THREE.Matrix4().makeRotationZ(θ)
  }
  console.warn(`Invalid generator ${generator}. Skipping.`)
  return new THREE.Matrix4()
}

function clamp(number: number, min = 0, max = 1) {
  return Math.max(min, Math.min(number, max));
}

function elementToRotation(seq: genstr[], cubelet: string, time = 1.0): THREE.Matrix4 {
  const pos: [number, number, number] = cubelet.split("").map(x => (Number(x) - 1) * (1.0 + 0.1)) as any
  const trans = new THREE.Matrix4().makeTranslation(...pos)
  const m = new THREE.Matrix4()
  let p = {}
  for (let i = 0; i < seq.length; i++) {
    if (i > time * seq.length) {
      break
    }
    const g : genstr = seq[i]
    m.premultiply(generatorToRotation(g, apply(p, cubelet), clamp((time * seq.length) - i)))
    p = compose(p, generators[g] ?? {})
  }
  m.multiply(trans)
  return m
}

function* prod(...iters: any[]): Generator<any[]> {
  if (iters.length === 0) {
    yield []
    return
  }
  let [xs, ...rest] = iters // [fixme] need to Tee the iters.
  for (let x of xs) {
    for (let ys of prod(...rest)) {
      yield [x, ...ys]
    }
  }
}

const cubelets = [...prod([0, 1, 2], [0, 1, 2], [0, 1, 2])].map(x => x.join(""))

interface CubeletProps {
  time: number;
  seq: genstr[];
  cid: string;
}

function Cubelet(props: CubeletProps) {
  const me = React.useRef<THREE.Mesh>()

  React.useEffect(() => {
    const m = elementToRotation(props.seq, props.cid, props.time ?? 1.0)
    if (me.current) {
      me.current.setRotationFromMatrix(m)
      me.current.position.setFromMatrixPosition(m)
    }
  }, [props.cid, props.time, props.seq])
  return (
    // @ts-ignore
    <mesh ref={me}>
      <boxGeometry args={[1, 1, 1]} />
      {colors.map((col, idx) => (
        <meshPhongMaterial key={idx} attach={`material-${idx}`} color={col} />
      ))}
    </mesh>
  )
}

interface CubeProps {
  time: number;
  seq: genstr[]
}

function Cube(props: CubeProps) {
  return <group>
    {cubelets.map(cubelet => <Cubelet key={cubelet} cid={cubelet} time={props.time} seq={props.seq} />)}
  </group>
}

export default function (props: any) {
  const seq = props.seq ?? []
  const [t, setT] = React.useState(100)
  return <div style={{ height: 300 }}>
    <input type="range" min="0" max="100" value={t} onChange={e => setT(e.target.value as any)} />
    <div>Sequence: {JSON.stringify(seq)}</div>
    <Canvas >
      <pointLight position={[150, 150, 150]} intensity={0.55} />
      <ambientLight color={0xffffff} />
      <group rotation-x={Math.PI * 0.25} rotation-y={Math.PI * 0.25}>
        <Cube seq={seq} time={t / 100} />
      </group>
      <OrbitControls />
    </Canvas>
  </div>
}
