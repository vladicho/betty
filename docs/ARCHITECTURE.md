# Arquitetura

Betty separa o planejamento do movimento, a simulacao e a futura integracao fisica.

```text
SVG ou PLT/HPGL do MoldeLab
          |
          v
 Importador + normalizacao
          |
          v
 Validacao da area de corte
          |
          v
   Planejador de rota
          |
          v
  Estado seguro da maquina
       /       \
      v         v
Simulador   Adaptador fisico (futuro)
```

## Modulos atuais

- `geometry.js`: operacoes geometricas independentes da interface.
- `job-pipeline.js`: deteccao do formato, classificacao, validacao e preparacao do trabalho.
- `path-planner.js`: prioriza cortes internos e reduz deslocamentos livres com busca pelo vizinho mais proximo.
- `machine-protocol.js`: converte a rota no protocolo neutro e versionado `betty-cut/1`.
- `machine.js`: maquina de estados, execucao temporal, pausa e emergencia.
- `importers/`: leitores seguros de SVG linear e PLT/HPGL.
- `adapters/`: fronteira do hardware, desabilitada nesta fase.
- `web/`: interface e visualizacao do percurso no Canvas 2D.

## Limite do prototipo

O SVG inicial aceita poligonos, polilinhas, retangulos e paths formados por `M`, `L`, `H`, `V` e `Z`. As dimensoes fisicas `mm`, `cm`, `in` ou `px` sao convertidas para milimetros usando o `viewBox`. Curvas devem ser convertidas em polilinhas no MoldeLab antes da exportacao. Essa restricao evita aproximacoes silenciosas que mudariam o molde.

No SVG de risco atual do MoldeLab, Betty reconhece a estrutura e remove fundo, cabecalho, linha final e margem de costura tracejada. Piques e fio ainda sao apenas anotacoes e nao sao enviados como cortes. No PLT essas entidades nao possuem semantica propria, portanto todas as trajetorias exigem revisao visual.

Nao existe adaptador fisico habilitado nesta versao. Uma futura integracao deve ficar em um processo separado e exigir telemetria, watchdog, intertravamentos e confirmacao local antes de habilitar movimento.
