# Addon Latam — plugin de Kino

Películas y series en español latino, con estrenos al día.

El catálogo y los enlaces los entrega el addon **Addon Latam**; este plugin los adapta al formato nativo de Kino.
No está afiliado con el addon ni con los servidores que lo alojan.

## Instalar

En Kino: **Plugins ▸ Agregar un plugin ▸ Kino**, y pega la dirección de este repositorio **sin `@rama`** (el código del
addon va sellado en el plugin y solo se abre desde la rama principal).

## Qué trae

- **Inicio**: estrenos de películas y de series, y lo más popular de cada una.
- **Sección propia «Latam»** con tres pestañas: **Estrenos**, **Películas** y **Series**. Las dos últimas traen filas de
  Populares, Mejor valoradas y una por género (Acción, Comedia, Drama, Terror, Ciencia ficción…), cada una con «Ver más».
- **Categorías**: una ficha por género de películas y de series, más los estrenos de cine y de series.
- **Búsqueda** de películas y series juntas.
- **Series**: la lista de episodios sale del propio Kino (TMDB), y cada episodio pide su video al addon.
- **Servidores**: la primera copia es la de tu idioma (latino primero) y la calidad preferida; las demás quedan en el
  menú de servidor, etiquetadas con opción, calidad e idioma.
- **Descarga** de películas y episodios.

## Ajustes

- **Calidad preferida**: la más alta (4K), hasta 1080p (por defecto) o hasta 720p. Las copias 4K pesan mucho en un
  TV box modesto.
- **Filas en Inicio**: apaga los estrenos del Inicio.
- **Estado del servicio**, **Caché**, **Comprobar servicio** y **Vaciar caché**.

## Notas

- El video llega desde servidores de terceros, a veces por `http` sin cifrar: Kino pide tu aprobación al instalar
  («Puede reproducir video desde cualquier servidor que indique»).
- Los **estrenos** salen del propio addon, así que siempre tienen copias. Las filas por **género** y lo **popular** se
  arman con TMDB (por Kino): algunos títulos pueden no estar en el addon todavía y entonces dicen que no tienen video; el
  addon ofrece solicitarlos en su propia página.
- Si el servicio cambia su código, el plugin deja de abrir hasta que se publique una versión nueva.
