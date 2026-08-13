# Betty

Betty e a ponte entre os arquivos de moldes produzidos pelo MoldeLab e uma futura maquina automatica de corte de tecido.

O projeto comeca pelo simulador porque trajetorias, estados e falhas precisam ser observaveis e testaveis antes de qualquer conexao com uma maquina real. A versao atual nao envia comandos para hardware.

## O que ja funciona

- mesa de corte em Canvas 2D;
- importacao de `SVG`, `PLT` e `HPGL`;
- conversao de coordenadas HPGL para milimetros;
- validacao dos limites configuraveis da mesa;
- identificacao de contornos internos, externos e trajetorias abertas;
- molde de demonstracao com contornos internos e externos;
- planejamento que corta detalhes internos primeiro;
- ordenacao por vizinho mais proximo para reduzir deslocamentos;
- velocidade configuravel;
- iniciar, pausar, liberar e parada de emergencia simulada;
- exibicao de progresso, distancia de corte e deslocamento livre;
- nucleo desacoplado da interface e coberto por testes.
- geracao do programa neutro `betty-cut/1` em JSON;
- gateway de hardware explicitamente bloqueado enquanto o controlador nao for definido.

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
src/core/       geometria, pipeline, planejador, protocolo e estados
src/importers/  leitores de SVG e PLT/HPGL
src/adapters/   fronteira isolada para o futuro hardware
web/            simulador visual
test/           testes automatizados
docs/           arquitetura, seguranca e roadmap
scripts/        servidor local sem dependencias
```

## Direcao tecnica

A arquitetura prevista separa tres responsabilidades:

1. importador, que converte SVG ou PLT/HPGL do MoldeLab em contornos normalizados;
2. validador, que impede coordenadas invalidas ou fora da mesa;
3. planejador de corte, que ordena os contornos e produz uma rota;
4. simulador, que permite revisar o processo inteiro no Canvas;
5. protocolo neutro, que gera comandos de movimento e ferramenta;
6. adaptador de maquina, que so sera habilitado depois da escolha do mecanismo e do controlador fisico.

Consulte [Arquitetura](docs/ARCHITECTURE.md), [Seguranca](docs/SAFETY.md) e [Roadmap](docs/ROADMAP.md).

## Aviso

Este software ainda nao e um controlador industrial. A parada mostrada na interface e apenas simulada e nunca deve substituir circuito de emergencia, sensores, protecoes ou avaliacao profissional.

## Licenca

MIT.
