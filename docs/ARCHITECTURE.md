# Arquitetura

Betty separa o planejamento do movimento, a simulacao e a futura integracao fisica.

```text
Arquivo vetorial / moldes
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
- `path-planner.js`: prioriza cortes internos e reduz deslocamentos livres com busca pelo vizinho mais proximo.
- `machine.js`: maquina de estados, execucao temporal, pausa e emergencia.
- `web/`: interface e visualizacao do percurso no Canvas 2D.

## Limite do prototipo

Nao existe adaptador fisico nesta versao. Uma futura integracao deve ficar em um processo separado e exigir telemetria, watchdog, intertravamentos e confirmacao local antes de habilitar movimento.
