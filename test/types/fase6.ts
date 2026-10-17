// Provas estáticas da fronteira específica da oficina; executadas pelo CI.
import type { Fase6Props, LevelDef, PuzzleContext } from '../../src/types';
import fase6 from '../../src/levels/fase6/index.js';
import { buildWorld } from '../../src/levels/fase6/world/index.js';
import { createPuzzle as createFase5 } from '../../src/levels/fase5/puzzle.js';

declare const context: PuzzleContext<Fase6Props>;
declare const real: ReturnType<typeof buildWorld>['props'];
const definition: LevelDef<Fase6Props> = fase6;
const props: Fase6Props = real;
context.props.pedal.setPress(0.4);
context.props.junction.setRoute('delivery');
context.props.train.setPose({ x: 1, z: -0.5, yaw: Math.PI });
context.props.nose.setSneeze(0.5);
context.props.ball.home.copy(context.props.ball.object.position);

// @ts-expect-error fábrica real não pode devolver props abertos ou any
real.train.metodoInventado();
// @ts-expect-error não há rota arbitrária além das duas declaradas
real.junction.setRoute('atalho');
// @ts-expect-error pose do trem precisa de orientação, além de XZ
real.train.setPose({ x: 1, z: 0 });
// @ts-expect-error pedal de impacto não tem API de portão
context.props.pedal.setOpen(1);
// @ts-expect-error consumidor não pode inventar prop pela fronteira comum
context.props.ventilador.setAligned(true);
const wrongPuzzle: LevelDef<Fase6Props> = {
  ...fase6,
  // @ts-expect-error puzzle da fase 5 não recebe os props da oficina
  createPuzzle: createFase5,
};

void [definition, props, wrongPuzzle];
