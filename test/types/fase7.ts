// Provas estáticas da fronteira da pracinha (fase 7) e do Lambe-Lambe; executadas pelo CI.
import type { Fase7Props, LevelDef, PuzzleContext, Puzzle, InputLock, DogAnim, NavEdge } from '../../src/types';
import fase7 from '../../src/levels/fase7/index.js';
import { buildWorld } from '../../src/levels/fase7/world/index.js';
import { createPuzzle as createFase5 } from '../../src/levels/fase5/puzzle.js';
import { stubFase7Props } from '../helpers/props.mjs';

declare const context: PuzzleContext<Fase7Props>;
declare const real: ReturnType<typeof buildWorld>['props'];
const definition: LevelDef<Fase7Props> = fase7;
const props: Fase7Props = real;
declare const fake: ReturnType<typeof stubFase7Props>;
const fakeProps: Fase7Props = fake;
context.props.gate.setOpen(0.5);
context.props.latch.setTurn(1);
context.props.ball.home.copy(context.props.ball.object.position);
context.props.frisbee.setHighlight(true);
context.props.goal.spot('frisbee').add(context.props.frisbee.object);
// @ts-expect-error a toalha só tem lugar para a bolinha e o frisbee
context.props.goal.spot('patinho');
// @ts-expect-error o trinco não tem API de portão
context.props.latch.setOpen(1);
// @ts-expect-error fábrica real não pode devolver props abertos ou any
real.gate.metodoInventado();
// @ts-expect-error consumidor não pode inventar prop pela fronteira comum
context.props.trem.setPose({ x: 0, z: 0, yaw: 0 });
const wrongPuzzle: LevelDef<Fase7Props> = {
  ...fase7,
  // @ts-expect-error puzzle da fase 5 não recebe os props da pracinha
  createPuzzle: createFase5,
};

// Lambe-Lambe e lama: ganchos opcionais do puzzle, pose roteirizada e entrada da animação
declare const puzzle: Puzzle;
const res = puzzle.onLick?.(context.ctrls.rhaenyra, { target: 'radhija', stroke: 1, point: { x: 0, y: 0.3, z: 0 }, local: { x: 0.1, y: 0.3, z: 0 } });
const scale: number | undefined = puzzle.speedScale?.(context.ctrls.radhija);
const lock: InputLock = { action: 'slide', faceX: 0, faceZ: 0, drive: true, slope: -0.4 };
const anim: DogAnim = { action: 'lick', lickPhase: 0.5, lickSide: -1, lickSolo: false, slope: 0.3 };
const edge: NavEdge = ['TW', 'TE', { requires: ['small', 'tunnel'] }];
// @ts-expect-error a lambida precisa dizer quem foi lambida
puzzle.onLick?.(context.ctrls.rhaenyra, { stroke: 1, point: { x: 0, y: 0, z: 0 }, local: { x: 0, y: 0, z: 0 } });
context.dogs.radhija.setMud?.(0.5, [{ x: 0, y: 0.3, z: 0.1, r: 0.08 }]);
context.dogs.radhija.setShine?.(1);

void [definition, props, fakeProps, wrongPuzzle, res, scale, lock, anim, edge];
