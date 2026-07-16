<!doctype html>
<html lang="en">
  {{> head title="{{label}}" css="/css/games/{{key}}.css" script="./{{key}}-main.ts"}}
  <body class="app-body">
    {{> shell-open title="{{label}}" key="{{key}}"}}
    <div class="game-details"></div>
    <div class="{{key}}-board game-board" id="board"></div>
    {{> shell-close}} {{> game-chrome}}
  </body>
</html>
