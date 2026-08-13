# Betty

Betty e uma base aberta para simular e, futuramente, integrar uma maquina automatica de corte de tecido.

O projeto comeca pelo simulador porque trajetorias, estados e falhas precisam ser observaveis e testaveis antes de qualquer conexao com uma maquina real. A versao atual nao envia comandos para hardware.

## O que ja funciona

- mesa de corte em Canvas 2D;
- molde de demonstracao com contornos internos e externos;
- planejamento que corta detalhes internos primeiro;
- ordenacao por vizinho mais proximo para reduzir deslocamentos;
- velocidade configuravel;
- iniciar, pausar, liberar e parada de emergencia simulada;
- exibicao de progresso, distancia de corte e deslocamento livre;
- nucleo desacoplado da interface e coberto por testes.

## Executar

Requer Node.js 20 ou superior.

```bash
npm run dev
```

Abra `http://localhost:4173`.

Para validar:

```bash
npm run check
npm test
```

## Estrutura

```text
src/core/       geometria, planejador e maquina de estados
web/            simulador visual
test/           testes automatizados
docs/           arquitetura, seguranca e roadmap
scripts/        servidor local sem dependencias
```

## Direcao tecnica

A arquitetura prevista separa tres responsabilidades:

1. planejador de corte, que recebe os contornos e produz uma rota;
2. controlador seguro, que valida estados e comandos;
3. adaptador de maquina, que so existira depois da escolha do mecanismo e do controlador fisico.

Consulte [Arquitetura](docs/ARCHITECTURE.md), [Seguranca](docs/SAFETY.md) e [Roadmap](docs/ROADMAP.md).

## Aviso

Este software ainda nao e um controlador industrial. A parada mostrada na interface e apenas simulada e nunca deve substituir circuito de emergencia, sensores, protecoes ou avaliacao profissional.

## Licenca

MIT.
