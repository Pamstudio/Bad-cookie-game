window.GAME_CONTENT = {
 "schema": 1,
 "id": "bad-cookie",
 "title": "BAD COOKIE",
 "tagline": "",
 "genre": "platformer",
 "orientation": "landscape",
 "players": "family",
 "version": 6,
 "palette": {
  "bg": "#2a1640",
  "panel": "#3a1f55",
  "accent": "#C8FF2E",
  "text": "#FFF1D6",
  "muted": "#FF5FA8",
  "danger": "#FF5FA8"
 },
 "story": {
  "style": "cinematic",
  "font": "sans",
  "transition": "fade"
 },
 "ui": {
  "dialog": {
   "layout": "bubble",
   "portrait": "circle",
   "name": "tab",
   "text": "typewriter",
   "fill": "#FFF1D6",
   "edge": "#6B3A1F",
   "ink": "#2a1a10",
   "nameColor": "#7B3FF2",
   "radius": 14
  },
  "hint": {
   "position": "top",
   "fill": "#FFF1D6",
   "edge": "#6B3A1F",
   "ink": "#2a1a10"
  }
 },
 "titleScreen": {
  "layout": "split-hero",
  "background": "location:parque",
  "ambient": "leaves",
  "titleStyle": {
   "font": "sans",
   "effect": "outline",
   "color": "#7B3FF2"
  },
  "showcase": "none"
 },
 "hero": "badi-flaca",
 "characters": {
  "badi-flaca": {
   "name": "Badi",
   "role": "hero",
   "color": "#FF5FA8",
   "sprite": "assets/characters/badi-flaca-idle.png",
   "anim": {
    "idle": "assets/characters/badi-flaca-idle.png",
    "walk": [
     "assets/characters/badi-flaca-walk-1.png",
     "assets/characters/badi-flaca-walk-2.png",
     "assets/characters/badi-flaca-walk-3.png",
     "assets/characters/badi-flaca-walk-4.png"
    ],
    "jump": "assets/characters/badi-flaca-jump.png",
    "fps": 9
   },
   "portrait": "assets/characters/badi-flaca-portrait.png",
   "bio": "Badi: piel #FF5FA8, pecas, melena negra con mechas #C8FF2E y orejitas de gato, top y calzas negros con franja lima. Etapa 1: flaca y desganada."
  },
  "badi-tonificada": {
   "name": "Badi",
   "role": "ally",
   "color": "#FF5FA8",
   "sprite": "assets/characters/badi-tonificada-idle.png",
   "anim": {
    "idle": "assets/characters/badi-tonificada-idle.png",
    "walk": [
     "assets/characters/badi-tonificada-walk-1.png",
     "assets/characters/badi-tonificada-walk-2.png",
     "assets/characters/badi-tonificada-walk-3.png",
     "assets/characters/badi-tonificada-walk-4.png"
    ],
    "jump": "assets/characters/badi-tonificada-jump.png",
    "fps": 9
   },
   "portrait": "assets/characters/badi-flaca-portrait.png",
   "bio": "Etapa 2: tonificada."
  },
  "badi-fuerte": {
   "name": "Badi",
   "role": "ally",
   "color": "#FF5FA8",
   "sprite": "assets/characters/badi-fuerte-idle.png",
   "anim": {
    "idle": "assets/characters/badi-fuerte-idle.png",
    "walk": [
     "assets/characters/badi-fuerte-walk-1.png",
     "assets/characters/badi-fuerte-walk-2.png",
     "assets/characters/badi-fuerte-walk-3.png",
     "assets/characters/badi-fuerte-walk-4.png"
    ],
    "jump": "assets/characters/badi-fuerte-jump.png",
    "fps": 9
   },
   "portrait": "assets/characters/badi-musculosa-portrait.png",
   "bio": "Etapa 3: fuerte."
  },
  "badi-musculosa": {
   "name": "Badi",
   "role": "ally",
   "color": "#FF5FA8",
   "sprite": "assets/characters/badi-musculosa-idle.png",
   "anim": {
    "idle": "assets/characters/badi-musculosa-idle.png",
    "walk": [
     "assets/characters/badi-musculosa-walk-1.png",
     "assets/characters/badi-musculosa-walk-2.png",
     "assets/characters/badi-musculosa-walk-3.png",
     "assets/characters/badi-musculosa-walk-4.png"
    ],
    "jump": "assets/characters/badi-musculosa-jump.png",
    "fps": 9
   },
   "portrait": "assets/characters/badi-musculosa-portrait.png",
   "bio": "Etapa 4: musculosa, la hoja de la autora."
  },
  "el-grandote": {
   "name": "El Grandote",
   "role": "npc",
   "color": "#7B3FF2",
   "sprite": "assets/characters/el-grandote-pose.png",
   "anim": {
    "walk": [
     "assets/characters/el-grandote-walk-1.png",
     "assets/characters/el-grandote-walk-2.png"
    ],
    "fps": 6
   },
   "portrait": "assets/characters/el-grandote-portrait.png",
   "bio": "Fisicoculturista enorme y canchero. Pasa por el parque y al final espía desde un arbusto."
  },
  "corredor": {
   "name": "Corredor",
   "role": "npc",
   "color": "#2bb3a3",
   "sprite": "assets/characters/corredor-walk-1.png",
   "anim": {
    "walk": [
     "assets/characters/corredor-walk-1.png",
     "assets/characters/corredor-walk-2.png"
    ],
    "fps": 7
   },
   "bio": "Corredor del parque.",
   "portrait": "assets/characters/corredor-walk-1.png"
  },
  "corredora": {
   "name": "Corredora",
   "role": "npc",
   "color": "#ff8c3a",
   "sprite": "assets/characters/corredora-walk-1.png",
   "anim": {
    "walk": [
     "assets/characters/corredora-walk-1.png",
     "assets/characters/corredora-walk-2.png"
    ],
    "fps": 7
   },
   "bio": "Corredora del parque.",
   "portrait": "assets/characters/corredora-walk-1.png"
  },
  "badi-sentada": {
   "name": "Badi",
   "role": "npc",
   "color": "#FF5FA8",
   "sprite": "assets/characters/badi-flaca-sentada.png",
   "bio": "Badi desparramada en el banco.",
   "portrait": "assets/characters/badi-flaca-sentada.png"
  },
  "badi-levanta": {
   "name": "Badi",
   "role": "npc",
   "color": "#FF5FA8",
   "sprite": "assets/characters/badi-levanta-pesa.png",
   "bio": "Levantando la pesa.",
   "portrait": "assets/characters/badi-levanta-pesa.png"
  },
  "badi-dorada": {
   "name": "Badi",
   "role": "npc",
   "color": "#FFD447",
   "sprite": "assets/characters/badi-levanta-pesa-dorada.png",
   "bio": "El guiño: pelo dorado erizado por un instante.",
   "portrait": "assets/characters/badi-levanta-pesa-dorada.png"
  },
  "grandote-arbusto": {
   "name": "El Grandote",
   "role": "npc",
   "color": "#7B3FF2",
   "sprite": "assets/characters/el-grandote-arbusto.png",
   "bio": "Espiando desde un arbusto.",
   "portrait": "assets/characters/el-grandote-arbusto.png"
  },
  "pesa-100kg": {
   "name": "Pesa de 100 kg",
   "role": "npc",
   "color": "#333333",
   "sprite": "assets/items/pesa.png",
   "bio": "La pesa del final.",
   "portrait": "assets/items/pesa.png"
  },
  "obst-senor-perro": {
   "name": "Señor con perro",
   "role": "enemy",
   "color": "#888888",
   "sprite": "assets/characters/obst-senor-perro.png",
   "facesLeft": true,
   "bio": "Obstáculo de la ciudad.",
   "portrait": "assets/characters/obst-senor-perro.png",
   "anim": "procedural"
  },
  "obst-chica-celular": {
   "name": "Chica con celular",
   "role": "enemy",
   "color": "#888888",
   "sprite": "assets/characters/obst-chica-celular.png",
   "facesLeft": true,
   "bio": "Obstáculo de la ciudad.",
   "portrait": "assets/characters/obst-chica-celular.png"
  },
  "obst-bici": {
   "name": "Ciclista",
   "role": "enemy",
   "color": "#888888",
   "sprite": "assets/characters/obst-bici.png",
   "facesLeft": true,
   "bio": "Obstáculo de la ciudad.",
   "portrait": "assets/characters/obst-bici.png",
   "anim": "procedural"
  },
  "obst-auto": {
   "name": "Auto",
   "role": "enemy",
   "color": "#888888",
   "sprite": "assets/characters/obst-auto.png",
   "facesLeft": true,
   "bio": "Obstáculo de la ciudad.",
   "portrait": "assets/characters/obst-auto.png",
   "anim": "procedural"
  },
  "obst-moto": {
   "name": "Moto",
   "role": "enemy",
   "color": "#888888",
   "sprite": "assets/characters/obst-moto.png",
   "facesLeft": true,
   "bio": "Obstáculo de la ciudad.",
   "portrait": "assets/characters/obst-moto.png",
   "anim": "procedural"
  }
 },
 "locations": {
  "parque": {
   "name": "El parque",
   "background": "assets/locations/parque.jpg",
   "music": "assets/audio/parque.mp3",
   "sky": "#7ec8f0",
   "tint": "#4a6b3a",
   "ground": "#4a6b3a",
   "groundTop": "#7cc04a",
   "platform": "#6B3A1F"
  },
  "barrio": {
   "name": "El barrio",
   "background": "assets/locations/barrio.jpg",
   "music": "assets/audio/ciudad.mp3",
   "sky": "#a8d8f0",
   "tint": "#6d6570",
   "ground": "#6d6570",
   "groundTop": "#b9b2bc",
   "platform": "#6B3A1F"
  },
  "avenida": {
   "name": "La ciclovía",
   "background": "assets/locations/avenida.jpg",
   "music": "assets/audio/ciudad.mp3",
   "sky": "#8cc8f0",
   "tint": "#5d5a66",
   "ground": "#5d5a66",
   "groundTop": "#7ec850",
   "platform": "#6B3A1F"
  },
  "centro": {
   "name": "Hora pico",
   "background": "assets/locations/centro.jpg",
   "music": "assets/audio/hora-pico.mp3",
   "sky": "#f0a860",
   "tint": "#5a4d55",
   "ground": "#5a4d55",
   "groundTop": "#a89aa4",
   "platform": "#6B3A1F"
  },
  "gimnasio": {
   "name": "La última cuadra",
   "background": "assets/locations/gimnasio.jpg",
   "music": "assets/audio/hora-pico.mp3",
   "sky": "#c070c0",
   "tint": "#4a3a55",
   "ground": "#4a3a55",
   "groundTop": "#9a7ab0",
   "platform": "#6B3A1F"
  }
 },
 "items": {
  "cookie-chips": {
   "name": "Cookie de chips",
   "image": "assets/items/cookie-chips.png",
   "color": "#e8c27a"
  },
  "cookie-pistacho": {
   "name": "Cookie de pistacho",
   "image": "assets/items/cookie-pistacho.png",
   "color": "#8fd14f"
  },
  "cookie-redvelvet": {
   "name": "Cookie red velvet",
   "image": "assets/items/cookie-redvelvet.png",
   "color": "#c0283c"
  },
  "cookie-chocolatosa": {
   "name": "Cookie chocolatosa",
   "image": "assets/items/cookie-chocolatosa.png",
   "color": "#6B3A1F"
  }
 },
 "sfx": {
  "jump": "assets/audio/sfx-jump.mp3",
  "collect": "assets/audio/sfx-collect.mp3",
  "stomp": "assets/audio/sfx-jump.mp3",
  "hurt": "assets/audio/sfx-hurt.mp3",
  "win": "assets/audio/sfx-win.mp3",
  "lose": "assets/audio/sfx-lose.mp3",
  "levelup": "assets/audio/sfx-levelup.mp3",
  "shrink": "assets/audio/sfx-shrink.mp3",
  "powerup": "assets/audio/sfx-powerup.mp3",
  "click": "assets/audio/sfx-click.mp3"
 },
 "music": {
  "title": "assets/audio/parque.mp3"
 },
 "keyArt": "assets/ui/keyart.jpg",
 "cutscenes": {},
 "chapters": [
  {
   "id": "ch1",
   "title": "De banco a bestia",
   "levels": [
    "l1",
    "l2",
    "l3",
    "l4"
   ]
  }
 ],
 "levels": {
  "l1": {
   "title": "Tramo 1: El barrio",
   "location": "barrio",
   "hero": "badi-flaca",
   "collectible": "cookie-chips",
   "enemy": "obst-senor-perro",
   "enemies": [
    "obst-senor-perro",
    "obst-chica-celular"
   ],
   "need": 2,
   "levelUp": "badi-tonificada",
   "intro": {
    "speaker": "badi-flaca",
    "text": "Flechas o A/D para moverme, Espacio para saltar. ¡Dos cookies y me pongo en forma!"
   },
   "map": [
    "............................................",
    "............................................",
    "............................................",
    "............................................",
    ".......................*....................",
    "...........*.........====...................",
    "..........===...............................",
    "...P.............e................e.......E.",
    "###########################..###############",
    "###########################..###############"
   ]
  },
  "l2": {
   "title": "Tramo 2: La ciclovía",
   "location": "avenida",
   "hero": "badi-tonificada",
   "collectible": "cookie-pistacho",
   "enemy": "obst-bici",
   "need": 2,
   "levelUp": "badi-fuerte",
   "intro": {
    "speaker": "badi-tonificada",
    "text": "¡Ojo con las bicis! Saltalas o caeles encima."
   },
   "map": [
    "..................................................",
    "..................................................",
    "..................................................",
    "..................................................",
    ".....................*............................",
    "....................====...............*..........",
    "........===...........................===.........",
    "...P.......e...............e.................e..E.",
    "##############..#################...##############",
    "##############..#################...##############"
   ]
  },
  "l3": {
   "title": "Tramo 3: Hora pico",
   "location": "centro",
   "hero": "badi-fuerte",
   "collectible": "cookie-redvelvet",
   "enemy": "obst-auto",
   "need": 2,
   "levelUp": "badi-musculosa",
   "intro": {
    "speaker": "badi-fuerte",
    "text": "¡OH NO, es la HORA PICOOO!"
   },
   "map": [
    "......................................................",
    "......................................................",
    "......................................................",
    "......................................................",
    ".................*.................*..................",
    "................====..............====................",
    "........................===.....................===...",
    "...P....e.............e....C............e...........E.",
    "############..###############...############..########",
    "############..###############...############..########"
   ]
  },
  "l4": {
   "title": "Tramo 4: La última cuadra",
   "location": "gimnasio",
   "hero": "badi-musculosa",
   "collectible": "cookie-chocolatosa",
   "enemy": "obst-moto",
   "enemies": [
    "obst-moto",
    "obst-auto",
    "obst-bici",
    "obst-chica-celular"
   ],
   "need": 2,
   "intro": {
    "speaker": "badi-musculosa",
    "text": "Últimas dos cookies. Algo pesado me espera al final de la cuadra…"
   },
   "map": [
    "..........................................................",
    "..........................................................",
    "..........................................................",
    "..........................................................",
    "...............*....................*.....................",
    "..............====.................====........====.......",
    "..............................===.........................",
    "...P...e............e........C...e............e......e..E.",
    "##########..#############...#############...##############",
    "##########..#############...#############...##############"
   ]
  }
 },
 "mapTitle": "Tramos",
 "outro": "¡Badi levantó los 100 kg!",
 "strings": {
  "win": "¡Tramo superado!",
  "lose": "¡Uy! Probá de nuevo",
  "toBeContinued": "Continuará…",
  "theEnd": "¡FIN!",
  "play": "JUGAR",
  "continue": "Continuar",
  "newGame": "Juego nuevo",
  "chapters": "Tramos",
  "collection": "Cookies",
  "paused": "Pausa",
  "resume": "Seguir",
  "restartLevel": "Reiniciar tramo",
  "restartGame": "Reiniciar juego",
  "quit": "Salir al inicio",
  "startOver": "Empezar de cero",
  "cancel": "Cancelar",
  "back": "Volver",
  "level": "Tramo",
  "best": "Mejor",
  "locked": "Bloqueado",
  "nothingFound": "Todavía no encontraste nada",
  "allDone": "¡Todo listo!",
  "confirmNew": "¿Empezar de cero? Se borra tu progreso.",
  "confirmRestart": "¿Reiniciar el juego desde el principio?",
  "rotate": "Girá el teléfono para jugar"
 },
 "tileSize": 48,
 "physics": {
  "gravity": 1500,
  "jump": 760,
  "speed": 280,
  "lives": 3,
  "enemySpeed": 70
 }
};
