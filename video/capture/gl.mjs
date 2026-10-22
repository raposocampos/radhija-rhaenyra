// Renderizador do Chromium na gravação das cenas. Os runners não têm GPU: o padrão dos testes do jogo é o
// SwiftShader (ANGLE). TRAILER_GL=gl usa o llvmpipe do Mesa pelo OpenGL e TRAILER_GL=vulkan, o lavapipe pelo Vulkan
// (os dois rasterizam com todos os núcleos). O jogo e as opções dos testes não mudam: só a gravação do trailer.
export function glArgs(base, mode = process.env.TRAILER_GL || 'swiftshader') {
  const args = base.args.filter((a) => !a.startsWith('--use-angle=') && !a.startsWith('--enable-unsafe-swiftshader'));
  if (mode === 'gl') args.push('--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization');
  else if (mode === 'vulkan') args.push('--use-angle=vulkan', '--use-gl=angle', '--enable-features=Vulkan', '--ignore-gpu-blocklist');
  else args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  return { ...base, args };
}
