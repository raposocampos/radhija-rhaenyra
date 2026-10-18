// Provas estáticas da fronteira específica da oficina; executadas pelo CI.
import type { Fase6Props, LevelDef, PuzzleContext } from '../../src/types';
import fase6 from '../../src/levels/fase6/index.js';
import { buildWorld } from '../../src/levels/fase6/world/index.js';
import { createPuzzle as createFase5 } from '../../src/levels/fase5/puzzle.js';
import { stubFase6Props } from '../helpers/props.mjs';

declare const context: PuzzleContext<Fase6Props>;
declare const real: ReturnType<typeof buildWorld>['props'];
const definition: LevelDef<Fase6Props> = fase6;
const props: Fase6Props = real;
declare const fake: ReturnType<typeof stubFase6Props>;
const fakeProps: Fase6Props = fake;
context.props.pedal.setPress(0.4);
context.props.junction.setRoute('delivery');
context.props.train.setPose({ x: 1, z: -0.5, yaw: Math.PI });
context.props.nose.setSneeze(0.5);
context.props.ball.home.copy(context.props.ball.object.position);
context.props.junction.setRoute('moon');
context.props.barrier.setOpen(1);
context.props.barrierPlate.setPress(0.5);
context.props.loader.setSpout(0.5);
context.props.goal.socket('moon').add(context.props.moon.object);
context.props.goal.launch();
// @ts-expect-error o foguete só tem berços para o planeta e a lua
context.props.goal.socket('sol');

// @ts-expect-error fábrica headless também preserva as três rotas declaradas
fake.junction.setRoute('atalho');
// @ts-expect-error guarda runtime não pode esconder retorno any da fábrica de teste
fake.train.metodoInventado();
// @ts-expect-error fábrica real não pode devolver props abertos ou any
real.train.metodoInventado();
// @ts-expect-error não há rota arbitrária além das três declaradas
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

void [definition, props, fakeProps, wrongPuzzle];
