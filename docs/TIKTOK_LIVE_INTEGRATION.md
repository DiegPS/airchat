# Investigación e integración de TikTok LIVE en AirChat

Fecha del análisis: 15 de julio de 2026.

Repositorio estudiado: `PirateTok/live-go`, clonado en `docs/live-go` para inspección local. El clon apunta a `6697c56ac4809c581d075b2d0aeb70a6fb55e108` (10 de abril de 2026). La última versión publicada por módulos Go es `v0.1.5`.

## Dictamen

`live-go` encaja bien con la arquitectura de AirChat y es la opción recomendada para una primera integración de TikTok LIVE en Go. No requiere servidor de firma, API key ni autenticación para un LIVE público; usa `context.Context`, entrega protobufs decodificados y ya implementa heartbeat, ACK, detección de conexión inactiva y reconexión.

No debe tratarse aún como una dependencia madura o completamente estable:

- El repositorio fue creado en abril de 2026, tiene pocas versiones y adopción pública mínima.
- Consume endpoints y WebSockets no oficiales de TikTok; cualquier cambio del servicio puede romperlo sin previo aviso.
- Su contrato sigue en `v0.x`, por lo que puede cambiar sin compatibilidad hacia atrás.
- Varias pruebas reales dependen de usuarios en directo o de capturas externas y se omiten en una ejecución normal.
- Tiene límites de ciclo de vida y backpressure que AirChat debe aislar en su propio adaptador.

La aplicación fija el commit estudiado mediante `github.com/PirateTok/live-go v0.1.6-0.20260410063317-6697c56ac480`, detrás de `tiktok_chat.go`. No usa `replace` hacia `docs/live-go`; el clon es material de investigación y pruebas upstream, no código vendorizado.

## Estado implementado

La integración descrita aquí está implementada de extremo a extremo:

- cuarta conexión simultánea e independiente para TikTok LIVE;
- opciones completas de `live-go` en Setup antes de conectar;
- estados `connecting`, `connected`, `reconnecting`, `ended` y `error`;
- conversión nativa de chat, emote-chat, gifts/combos, follows, shares, joins, subscriptions, questions, likes y audiencia;
- descriptor explícito y datos estructurados para los 72 valores actuales de `events.EventType`;
- panel con métricas, eventos expandibles, datos protobuf JSON, Base64 para unknown y exportación JSON;
- metadata de sala y creador, roles, nivel gifter/fan club y filtros de audiencia;
- visibilidad por categoría, límites de joins/métricas y umbral de diamantes;
- rendering, Preview, accent e identificación TikTok;
- TTS separado para gifts, actividad y eventos avanzados; los combos se leen una sola vez al finalizar;
- cookies de sesión disponibles en runtime pero eliminadas siempre de `localStorage`;
- deduplicación global corregida a `(Platform, ID)` y actualización estable de combos;
- bindings Wails, pruebas Go/frontend y build de producción.

No se declara que una sala real concreta haya producido cada evento raro: TikTok controla qué protobufs emite y cuándo. La cobertura del adaptador se verifica con protobufs en memoria, la enumeración completa de `live-go`, Preview y el inspector; los fallos de transporte que la biblioteca solo escribe a su log siguen siendo una limitación upstream observable en el estado, no funcionalidad omitida por AirChat.

## Principio de completitud

AirChat debe consumir y clasificar todos los eventos entregados por `live-go`, no únicamente chat y gifts. Que una categoría venga desactivada por defecto para proteger el overlay del spam no significa que esté sin implementar: el usuario debe poder activarla, verla, filtrarla y decidir si participa en overlay, TTS, métricas o diagnóstico.

La integración no se dará por finalizada con marcadores “próximamente”, controles deshabilitados, payloads conocidos ignorados o tareas funcionales pospuestas. Las únicas limitaciones aceptables al cierre serán comportamientos demostrablemente originados dentro de `live-go` o de TikTok, y deberán aparecer claramente en el estado/diagnóstico de la interfaz.

## Qué ofrece realmente `live-go`

### Conexión

Uso básico:

```go
ctx, cancel := context.WithCancel(parent)
eventsCh, err := golive.NewClient(username).
    MaxRetries(5).
    StaleTimeout(60 * time.Second).
    Connect(ctx)
```

`Connect` primero resuelve el usuario a un room ID mediante `api-live/user/room`, obtiene una cookie `ttwid`, construye el WebSocket de TikTok y entrega eventos tipados en un canal con buffer de 256.

La configuración incluye CDN global/EU/US, timeout HTTP, reintentos, timeout por inactividad, user-agent, cookies, idioma, región, proxy y, en `main` todavía no publicado, compresión.

### Eventos útiles para AirChat

| Evento | Protobuf | Uso correcto en AirChat |
|---|---|---|
| `EventChat` | `WebcastChatMessage` | Mensaje normal con texto y emotes indexados |
| `EventEmoteChat` | `WebcastEmoteChatMessage` | Mensaje compuesto solo por emotes TikTok |
| `EventGift` | `WebcastGiftMessage` | Tarjeta de regalo, combo, cantidad y diamantes |
| `EventSubNotify` / `EventSubscriptionNotify` | mensajes de suscripción | Actividad de nueva suscripción/renovación |
| `EventFollow` | `WebcastSocialMessage` | Actividad de follow configurable por el usuario |
| `EventShare` | `WebcastSocialMessage` | Actividad de share configurable por el usuario |
| `EventLike` | `WebcastLikeMessage` | Contador agregado; no crear un bubble por evento |
| `EventRoomUserSeq` | `WebcastRoomUserSeqMessage` | Audiencia actual y top viewers |
| `EventJoin` | `WebcastMemberMessage` | Actividad disponible, desactivada por defecto por volumen |
| `EventLiveEnded` | `WebcastControlMessage` | Terminar la sesión TikTok explícitamente |
| `EventReconnecting` | texto de intento/backoff | Estado de conexión en sidebar |
| `EventDisconnected` | sin detalle de error | Cierre final de la sesión |

La biblioteca decodifica muchos otros eventos de ranking, preguntas, objetivos, encuestas, link-mic y commerce. Todos deben ser consumibles desde AirChat, aunque no todos deban mostrarse por defecto como bubbles. AirChat conservará la semántica de TikTok: chat y actividad visible, contadores/estado, y un panel avanzado de eventos estructurados.

### Cobertura completa de eventos

La interfaz deberá cubrir las categorías completas declaradas en `events/types.go`:

- lifecycle: connected, reconnecting y disconnected;
- core: chat, gift, like, member, social, room user sequence y control;
- sub-routed: follow, share, join y live ended;
- contenido útil: live intro, room message, captions, goals e IM delete;
- interacción avanzada: questions, emote chat, polls, envelope y room pin;
- rankings: rank update, hourly rank, rank text y viewer picks;
- link-mic: method, battle, armies, fan tickets, messages, layers y layout state;
- gifts: panel update, broadcast, dynamic restriction, binding gift y prompts;
- suscripciones: sub notify, subscription notify, capsule y pin events;
- sistema/UI: system message, barrage, guide, banners, notice, notify, toast, bottom message, speaker y perception;
- commerce, games y partnerships;
- access control, recall, moderation y verification;
- `EventUnknown` para métodos todavía no reconocidos por la versión fijada.

Los eventos conocidos tendrán nombre, categoría, timestamp, resumen y datos relevantes estructurados. Los eventos complejos o raros podrán usar una tarjeta avanzada genérica, pero nunca desaparecer silenciosamente. `EventUnknown` conservará método, tamaño y metadata segura para diagnóstico; el payload binario podrá exportarse desde diagnóstico, pero no se interpolará como texto ni se enviará a TTS.

### Datos de usuario disponibles

Los protobufs incluyen:

- `nickname`, `unique_id`, `display_id`, ID numérico e `id_str`.
- avatar thumbnail/medium/large.
- cuenta verificada.
- badges, fan club y nivel de gifter.
- flags de follower/following y suscripción.
- `UserIdentity` relativo al host: anchor, moderador, subscriber, follower y gift giver.

Para AirChat, `UserIdentity` debe ser la fuente principal de roles por mensaje. Los campos del `User` sirven como fallback.

## Riesgos encontrados al leer el código

### 1. “Connected” no confirma todavía el WebSocket

`client.Connect` inserta `EventConnected` inmediatamente después de resolver el room ID y antes de que la goroutine obtenga `ttwid` o complete el handshake WSS. En AirChat ese evento debe significar “LIVE resuelto / conectando”, no una conexión totalmente saludable.

La UI debe manejar al menos `connecting`, `connected`, `reconnecting`, `ended` y `error`. Como la biblioteca no expone un evento inequívoco de handshake completado, la primera trama/evento recibido puede promover el estado a `connected`.

### 2. Eventos descartados silenciosamente

El canal tiene capacidad 256 y `connection.processFrame` usa un `select` con `default`; cuando el consumidor no alcanza el ritmo, el evento se pierde sin error. Lo mismo ocurre con algunos eventos de lifecycle.

El adaptador de AirChat debe consumir el canal continuamente y con muy poco trabajo:

- actualizar acumuladores en memoria;
- convertir únicamente eventos seleccionados;
- emitir por Wails solo los datos necesarios;
- no hacer descargas, scraping ni trabajo costoso dentro del loop.

Likes, joins y audience updates nunca deben convertirse uno a uno en mensajes del overlay.

### 3. Cancelación no necesariamente inmediata

Cancelar el contexto no cierra directamente el socket bloqueado en lectura. La lectura usa un deadline igual a `StaleTimeout` (60 segundos por defecto), por lo que la goroutine puede tardar en salir y todavía puede procesar una trama recibida justo después de cancelar.

AirChat necesita un identificador de generación/sesión. Antes de emitir cualquier evento, el adaptador debe comprobar que sigue siendo la sesión TikTok activa. Esto impide que una conexión reemplazada o detenida contamine una sesión nueva.

También conviene configurar un `StaleTimeout` menor, por ejemplo 30 segundos, sin hacerlo tan agresivo que provoque reconexiones normales innecesarias.

### 4. Fin del LIVE no detiene automáticamente el cliente

El router produce `EventLiveEnded`, pero el cliente no cancela su ciclo por ese evento. El adaptador debe cancelar la sesión, emitir `tiktok_ended` una sola vez y abandonar su loop.

### 5. Errores terminales poco observables

Después de `Connect`, los errores WSS se escriben con `log.Printf`; el consumidor recibe reconexión/desconexión, pero no el error terminal detallado. AirChat podrá mostrar un estado fiable, aunque a veces no una causa exacta.

No se debe inventar un diagnóstico que la biblioteca no entrega. AirChat mostrará el último estado observable, los reintentos y una indicación explícita cuando la causa exacta solo exista en el log interno de `live-go`. Si durante la implementación hace falta exponer ese error, la corrección se realizará en el adaptador o se propondrá upstream antes de considerar terminada la integración.

### 6. Proxy anunciado más ampliamente que su implementación WSS

La ruta WSS personalizada implementa manualmente un túnel HTTP `CONNECT`. Aunque la documentación anuncia HTTP/HTTPS/SOCKS5, `proxyNetDial` no realiza un handshake SOCKS5 ni TLS hacia un proxy HTTPS. Por inspección, solo debe considerarse fiable un proxy HTTP CONNECT hasta verificar o corregir upstream las otras variantes.

AirChat expondrá las opciones de conexión de la biblioteca en un bloque avanzado: CDN global/EU/US o personalizado, timeout, reintentos, stale timeout, idioma, región, compresión cuando esté disponible en una versión publicada, cookies de sesión y proxy. La interfaz advertirá que, por el código actual, HTTP CONNECT es la variante WSS verificable y que SOCKS5/HTTPS pueden fallar por una limitación de `live-go`.

### 7. Regalos y combos no son Super Chats

TikTok emite conteos acumulativos durante una racha. Mostrar `RepeatCount` como un regalo nuevo en cada trama duplicaría cantidades y diamantes. Debe usarse `helpers.GiftStreakTracker` para calcular deltas y totales.

Un regalo TikTok merece un modelo propio; reutilizar `SuperChat` mezclaría conceptos y rompería futuras opciones de TTS, imagen, combo y diamantes.

### 8. Emotes requieren validación con capturas reales

El chat normal entrega `content` y una lista `EmoteWithIndex`; los mensajes solo-emote usan otro protobuf. La biblioteca decodifica esos campos pero no ofrece un helper para convertirlos al arreglo `MessageItem` de AirChat.

La conversión debe ser Unicode-safe, usar la primera URL no vacía de la imagen y validarse contra capturas reales de TikTok antes de declararla terminada. Si una posición es inválida, el fallback correcto es conservar el texto completo y añadir el emote sin destruir contenido.

### 9. Streams restringidos y cookies

Los LIVE públicos no requieren login. `FetchRoomInfo` puede necesitar cookies para salas 18+, pero es una llamada separada. Para no excluir esa capacidad, AirChat ofrecerá cookies de sesión como ajuste avanzado secreto y exclusivamente en memoria por defecto. Nunca se guardarán en `localStorage`, logs o eventos Wails. Si se permite persistencia, deberá implementarse almacenamiento nativo seguro como parte del mismo trabajo, no texto plano ni una tarea futura.

## Diseño implementado en AirChat

### Backend: archivo y sesión independientes

`tiktok_chat.go` mantiene `app.go` como orquestador y usa estos campos:

```go
tiktokMu         sync.Mutex
tiktokCancel     context.CancelFunc
tiktokGeneration uint64
```

No hace falta guardar `*golive.Client`, porque la API se detiene cancelando el contexto. La generación debe incrementarse en cada start/stop y viajar al consumer.

Métodos Wails:

```go
func (a *App) StartTikTokChat(username string, options TikTokConnectOptions) error
func (a *App) StopTikTokChat()
func (a *App) CheckTikTokLive(username string, timeoutSeconds int) (string, error)
func (a *App) GetTikTokRoomInfo(roomID string, timeoutSeconds int, cookies string) (*http.RoomInfo, error)
```

`StartTikTokChat` debe:

1. Normalizar URL, `@usuario` o nombre simple.
2. Rechazar entrada vacía y caracteres/path inválidos.
3. Crear un contexto nuevo.
4. Ejecutar `Connect` fuera del mutex.
5. Intercambiar atómicamente la sesión y cancelar la anterior.
6. Iniciar un consumer protegido por generación.
7. Emitir lifecycle/status sin afectar YouTube, Twitch o Kick.

### Eventos Wails

Mantener `chat_message` como contrato unificado para elementos renderizables y añadir estado separado:

```text
tiktok_started       { username, roomId }
tiktok_reconnecting  { attemptText }
tiktok_status        { viewers, totalLikes, connected, reconnecting }
tiktok_error         string
tiktok_ended         { username, reason }
```

Todos los callbacks deben ignorarse si su generación ya no es la activa.

Añadir además un canal estructurado para capacidades que no pertenecen al feed convencional:

```text
tiktok_event        evento TikTok conocido, normalizado y categorizado
tiktok_metrics      likes, audiencia, ranking y acumuladores
tiktok_event        también transporta categorías `diagnostic` y `profile`
```

El usuario decidirá en ajustes qué categorías de `tiktok_event` se reflejan también como `chat_message`. De esta manera todas son consumibles sin convertir por fuerza cada actualización en un bubble.

### Modelo unificado de mensajes

Ampliar `ChatItem` sin romper las plataformas existentes:

```ts
type Platform = 'youtube' | 'twitch' | 'kick' | 'tiktok';
type ChatEventKind = 'chat' | 'membership' | 'gift' | 'follow' | 'share' | 'join';

interface GiftEvent {
  Name: string;
  Count: number;
  DiamondCount: number;
  Image?: ImageItem;
  IsCombo: boolean;
  IsFinal: boolean;
}

interface ChatItem {
  // campos actuales
  Platform?: Platform;
  EventKind?: ChatEventKind;
  Gift?: GiftEvent;
}
```

No reemplazar `SuperChat`; conservarlo exclusivamente para YouTube.

### Conversión de chat TikTok

| Campo AirChat | Fuente TikTok |
|---|---|
| `ID` | `Common.MsgId` convertido a string |
| `Platform` | `tiktok` |
| `Author.Name` | `User.Nickname`, fallback `UniqueId` |
| `Author.ChannelID` | `IdStr`, fallback `UniqueId`, fallback ID numérico |
| `Author.Thumbnail.URL` | primera URL de `AvatarThumb`, luego medium/large |
| `Message` | `Content` + `EmotesList`, o `EmoteList` para emote-only |
| `IsOwner` | `UserIdentity.IsAnchor` |
| `IsModerator` | `UserIdentity.IsModeratorOfAnchor`, fallback admin |
| `IsMembership` | subscriber identity, `IsSubscribe` o `SubscribeInfo` |
| `IsVerified` | `User.Verified` |
| `Timestamp` | `Common.CreateTime` normalizado a RFC3339 |

La deduplicación frontend debe cambiar de solo `ID` a clave `(Platform, ID)`. Con cuatro proveedores, asumir IDs globalmente únicos es incorrecto y ya constituye un riesgo latente entre las plataformas actuales.

### Experiencia de usuario

Agregar un cuarto campo en Setup:

- etiqueta TikTok;
- acepta `usuario`, `@usuario` o `tiktok.com/@usuario`;
- persistencia `airchat_last_tiktok`;
- error y estado independientes;
- conexión simultánea con cualquier combinación de plataformas.

Actualizar:

- `App.tsx`, `HomePage`, `ChatPage`, `Sidebar` y `TitleBar` con estado TikTok.
- `PreviewArea` con icono y accent TikTok configurable.
- Preview backend con protobufs válidos de `live-go` para chat, roles, emote-only, regalo individual/combo, follow, share, join, suscripción, pregunta, likes, audiencia y evento desconocido seguro.
- `Platform` en tipos y avatar fallback.
- desconexión global para llamar también `StopTikTokChat`.
- `useTTS` para considerar TikTok activo y deduplicar por plataforma.

### Ajustes TikTok

La sección TikTok debe ser completa desde el lanzamiento, con defaults conservadores:

```text
TikTok accent                 on
Show gifts                   on
Show subscriptions           on
Show follows                 off
Show shares                  off
Show joins                   off
Show viewer/like bubbles     off (las métricas siguen visibles en estado/inspector)
Read TikTok gifts with TTS   off
```

Likes y audiencia van a estado/HUD, no al feed. Los joins deben estar apagados por defecto porque un LIVE grande puede producir una tasa muy alta.

Además debe incluir:

- visibilidad individual para chat, emote chat, gifts, subscriptions, follows, shares, joins, questions, goals, polls, rankings, captions, pins, battles/link-mic, system/UI, commerce, games/partnerships y eventos desconocidos;
- destino por categoría: overlay, panel de actividad, métricas, TTS y/o solo diagnóstico;
- rate limit y agregación configurables para likes, joins y actualizaciones repetitivas;
- filtros por tipo de evento, usuario, palabras, valor mínimo de diamantes y nivel/rol;
- formato visual y accent TikTok;
- formato de TTS por chat, gift, subscription y actividad;
- CDN, locale, timeout, retries, stale timeout, proxy y cookies secretas;
- exportación de diagnóstico y contador de eventos recibidos por tipo.

Ningún toggle será un placeholder: al finalizar, todos deberán controlar un flujo implementado y probado.

### TTS

Chat TikTok normal entra al flujo actual. Los emotes sin texto no deben pronunciar URLs ni IDs. Actividad y regalos requieren toggles separados.

Para gifts, el texto sugerido es semántico y se genera desde `GiftEvent`, por ejemplo: “Ana sent Rose times 5”; no convertir el regalo a texto falso dentro de `Message` solamente para hacer funcionar TTS.

El modo members-only debe reconocer subscriber TikTok mediante `IsMembership` y mantener el allowlist actual.

## Verificación implementada

Las pruebas Go construyen protobufs en memoria y comprueban normalización de entrada, cobertura explícita de todo `EventType`, roles y metadata, Unicode/emotes, totales e identidad estable de combos, exportación segura de eventos desconocidos e invalidación de sesiones antiguas.

Vitest comprueba límites de joins/métricas, umbral de gifts, categorías unknown, filtros de nivel/rol, deduplicación entre plataformas, reemplazo de combos y eliminación de cookies antes de persistir. `npm run build` valida tipos y bundle; `wails build` valida bindings, frontend embebido y ejecutable Windows.

El Preview backend cubre los formatos confirmados de chat, emote, regalo individual y combo, follow, share, join, subscription, question, likes, audiencia y unknown. Sus fixtures se serializan como protobuf y pasan por `live-go/events.Decode` y los conversores de producción. No se inventan cuerpos para eventos opacos, como `GiftDynamicRestriction`, ni para categorías cuyo formato no esté suficientemente definido. El diagnóstico permite revisar los payloads adicionales que una sala real entregue sin que la suite normal dependa de que un creador específico esté LIVE.

## Criterios de aceptación satisfechos

- TikTok funciona solo o simultáneamente con las otras tres plataformas y su lifecycle es independiente.
- Stop/restart invalida por generación cualquier evento tardío.
- Texto, Unicode, avatares, emotes, roles y metadata de audiencia se conservan.
- Gifts no duplican combos/diamantes y TTS espera el cierre del combo.
- Likes, joins y métricas tienen estado, agregación y límites configurables.
- Filtros, rendering y TTS reconocen TikTok de forma nativa.
- Las cookies no se guardan en `localStorage` ni aparecen en eventos.
- La UI diferencia resolución, conexión por primera trama, reconexión, fin y error.
- Cada `EventType` conocido tiene descriptor, categoría, inspector y destino de overlay configurable.
- `EventUnknown` y diagnósticos se inspeccionan/exportan de forma segura.
- No existen controles “próximamente”, rutas vacías ni capacidades deliberadamente pospuestas.

## Evaluación final

| Área | Evaluación |
|---|---|
| Encaje técnico con Wails/Go | Alto |
| Facilidad de chat básico | Alta |
| Cobertura semántica TikTok | Completa para la superficie expuesta por `live-go` |
| Madurez del proyecto | Baja |
| Estabilidad esperada frente a cambios de TikTok | Media-baja |
| Licencia | Excelente (0BSD) |
| Resultado | Integración completa, aislada y fijada al commit analizado |

El mayor error sería reutilizar superficialmente el adaptador de Twitch o Kick. La implementación excelente consiste en mantener el feed unificado de AirChat, pero conservar gifts, combos, subscriptions, activity y métricas como conceptos TikTok nativos.
