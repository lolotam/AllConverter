![AllConverter](images/logo.png)

# AllConverter

[![Check Lint](https://github.com/lolotam/AllConverter/actions/workflows/check-lint.yml/badge.svg?branch=main)](https://github.com/lolotam/AllConverter/actions/workflows/check-lint.yml)
[![Check Tests](https://github.com/lolotam/AllConverter/actions/workflows/run-bun-test.yml/badge.svg?branch=main)](https://github.com/lolotam/AllConverter/actions/workflows/run-bun-test.yml)
![GitHub repo size](https://img.shields.io/github/repo-size/lolotam/AllConverter)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

An online file converter. Supports over a thousand different formats. Written with TypeScript,
Bun and Elysia.

A fork of [C4illin/ConvertX](https://github.com/C4illin/ConvertX), which is where the converter
engine and most of this list came from. See [Credits](#credits).

## Features

- Convert files to different formats
- Process multiple files at once
- Password protection
- Multiple accounts

## Converters supported

| Converter                                                       | Use case         | Converts from | Converts to |
| --------------------------------------------------------------- | ---------------- | ------------- | ----------- |
| [Inkscape](https://inkscape.org/)                               | Vector images    | 7             | 17          |
| [libjxl](https://github.com/libjxl/libjxl)                      | JPEG XL          | 11            | 11          |
| [resvg](https://github.com/RazrFalcon/resvg)                    | SVG              | 1             | 1           |
| [Vips](https://github.com/libvips/libvips)                      | Images           | 45            | 23          |
| [libheif](https://github.com/strukturag/libheif)                | HEIF             | 2             | 4           |
| [XeLaTeX](https://tug.org/xetex/)                               | LaTeX            | 1             | 1           |
| [Calibre](https://calibre-ebook.com/)                           | E-books          | 26            | 19          |
| [LibreOffice](https://www.libreoffice.org/)                     | Documents        | 41            | 22          |
| [Dasel](https://github.com/TomWright/dasel)                     | Data Files       | 5             | 4           |
| [Pandoc](https://pandoc.org/)                                   | Documents        | 43            | 65          |
| [msgconvert](https://github.com/mvz/email-outlook-message-perl) | Outlook          | 1             | 1           |
| VCF to CSV                                                      | Contacts         | 1             | 1           |
| [dvisvgm](https://dvisvgm.de/)                                  | Vector images    | 4             | 2           |
| [ImageMagick](https://imagemagick.org/)                         | Images           | 245           | 183         |
| [GraphicsMagick](http://www.graphicsmagick.org/)                | Images           | 167           | 130         |
| [Assimp](https://github.com/assimp/assimp)                      | 3D Assets        | 77            | 23          |
| [FFmpeg](https://ffmpeg.org/)                                   | Video            | ~472          | ~199        |
| [Potrace](https://potrace.sourceforge.net/)                     | Raster to vector | 4             | 11          |
| [VTracer](https://github.com/visioncortex/vtracer)              | Raster to vector | 8             | 1           |
| [Markitdown](https://github.com/microsoft/markitdown)           | Documents        | 6             | 1           |
| [pdftops](https://poppler.freedesktop.org/)                     | Documents        | 1             | 2           |

<!-- many ffmpeg fileformats are duplicates -->

Any missing converter? Open an issue or pull request!

## Deployment

> [!WARNING]
> If you can't login, make sure you are accessing the service over localhost or https otherwise set HTTP_ALLOWED=true

This fork publishes no image to a registry — it is built from the `Dockerfile` in this
repository, which is also how the hosted site is deployed.

```yml
# docker-compose.yml
services:
  allconverter:
    build: .
    container_name: allconverter
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - JWT_SECRET=aLongAndSecretStringUsedToSignTheJSONWebToken1234 # will use randomUUID() if unset
      # - HTTP_ALLOWED=true # uncomment this if accessing it over a non-https connection
    volumes:
      - ./data:/app/data
```

or

```bash
docker build -t allconverter .
docker run -p 3000:3000 -v ./data:/app/data allconverter
```

The build installs every converter, so expect it to take several minutes the first time.

Then visit `http://localhost:3000` in your browser and create your account. Don't leave it unconfigured and open, as anyone can register the first account.

If you get unable to open database file run `chown -R $USER:$USER path` on the path you choose.

### Environment variables

All are optional, JWT_SECRET is recommended to be set.

| Name                         | Default                                            | Description                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT_SECRET                   | when unset it will use the value from randomUUID() | A long and secret string used to sign the JSON Web Token                                                                                                      |
| ACCOUNT_REGISTRATION         | false                                              | Allow users to register accounts                                                                                                                              |
| HTTP_ALLOWED                 | false                                              | Allow HTTP connections, only set this to true locally                                                                                                         |
| ALLOW_UNAUTHENTICATED        | false                                              | Allow unauthenticated users to use the service, only set this to true locally                                                                                 |
| AUTO_DELETE_EVERY_N_HOURS    | 24                                                 | Checks every n hours for files older then n hours and deletes them, set to 0 to disable                                                                       |
| WEBROOT                      |                                                    | The address to the root path setting this to "/convert" will serve the website on "example.com/convert/"                                                      |
| BRANDING                     | AllConverter Tech                                  | Custom string that allows you to change the display name of the website in the header (max 26 characters)                                                     |
| FFMPEG_ARGS                  |                                                    | Arguments to pass to the input file of ffmpeg, e.g. `-hwaccel vaapi`. See https://github.com/C4illin/ConvertX/issues/190 for more info about hw-acceleration. |
| FFMPEG_OUTPUT_ARGS           |                                                    | Arguments to pass to the output of ffmpeg, e.g. `-preset veryfast`                                                                                            |
| HIDE_HISTORY                 | false                                              | Hide the history page                                                                                                                                         |
| LANGUAGE                     | en                                                 | Language to format date strings in, specified as a [BCP 47 language tag](https://en.wikipedia.org/wiki/IETF_language_tag)                                     |
| UNAUTHENTICATED_USER_SHARING | false                                              | Shares conversion history between all unauthenticated users                                                                                                   |
| MAX_CONVERT_PROCESS          | 0                                                  | Maximum number of conversions running at once across all users. Set to 0 to use the number of CPU cores.                                                      |
| CLIENT_IP_HEADER             |                                                    | Header holding the real client IP behind a proxy (e.g. `cf-connecting-ip`). Used for guest quotas.                                                            |
| UPLOAD_CHUNK_SIZE_MB         | 16                                                 | Chunk size for resumable uploads. Keep below Cloudflare's 100 MB request limit and 100 s timeout.                                                             |
| TUS_UPLOAD_EXPIRY_HOURS      | 24                                                 | How long an abandoned partial upload is kept before it is deleted.                                                                                            |
| CANONICAL_HOST               |                                                    | The one hostname the site answers on, e.g. `allconverter.tech`. Requests to `www.` of it are redirected, so a session is not split between the two.           |
| SETUP_TOKEN                  |                                                    | When set, the first-run setup page only creates the admin account for someone passing `?token=...`. Leave empty to keep setup open.                           |
| DOWNLOAD_TOKEN_TTL_MINUTES   | 60                                                 | How long a signed download link stays valid. Signed links let download managers fetch a file without the session cookie.                                      |
| GOOGLE_CLIENT_ID             |                                                    | Google OAuth client id. Sign in with Google is hidden until the id and secret are both set. See docs/google-oauth-setup.md.                                   |
| GOOGLE_CLIENT_SECRET         |                                                    | Google OAuth client secret.                                                                                                                                   |
| GOOGLE_REDIRECT_URI          |                                                    | Override for the OAuth callback. Defaults to the requested host plus `/auth/google/callback`.                                                                 |
| PADDLE_ENVIRONMENT           | sandbox                                            | Paddle environment: `sandbox` or `production`.                                                                                                                |
| PADDLE_CLIENT_TOKEN          |                                                    | Paddle client-side token (starts with `test_` or `live_`), used by the checkout overlay.                                                                      |
| PADDLE_WEBHOOK_SECRET        |                                                    | Secret of the Paddle notification destination pointing at `/paddle/webhook`.                                                                                  |
| PADDLE_PRICE_<TIER>          |                                                    | Paddle price id for a tier, e.g. `PADDLE_PRICE_PRO=pri_...`. Checkout is hidden until one is set.                                                             |
| PADDLE_API_KEY               |                                                    | Optional. Paddle API key, enables the "Manage billing" customer portal link.                                                                                  |
| PORT                         | 3000                                               | Application listen port                                                                                                                                       |

### Docker images

This fork does not publish an image. Build it from the `Dockerfile` as shown above; the
hosted site is deployed the same way, straight from `main`.

If you would rather run a prebuilt image and do not need the changes in this fork, upstream
publishes one on [GitHub Container Registry](https://github.com/C4illin/ConvertX/pkgs/container/ConvertX)
and [Docker Hub](https://hub.docker.com/r/c4illin/convertx).

### Tutorial

> [!NOTE]
> These are written by other people, and may be outdated, incorrect or wrong.

Tutorial in french: <https://belginux.com/installer-convertx-avec-docker/>

Tutorial in chinese: <https://xzllll.com/24092901/>

Tutorial in polish: <https://www.kreatywnyprogramista.pl/convertx-lokalny-konwerter-plikow>

## Screenshots

![AllConverter Preview](images/preview.png)

## Development

0. Install [Bun](https://bun.sh/) and Git
1. Clone the repository
2. `bun install`
3. `bun run dev`

Pull requests are welcome! See open issues for the list of todos. The ones tagged with "converter request" are quite easy. Help with docs and cleaning up in issues are also very welcome!

Use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) for commit messages.

## Credits

AllConverter is a fork of [ConvertX](https://github.com/C4illin/ConvertX) by
[C4illin](https://github.com/C4illin) and its
[contributors](https://github.com/C4illin/ConvertX/graphs/contributors), who wrote the
converter engine this is still built on.

<a href="https://github.com/C4illin/ConvertX/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=C4illin/ConvertX" alt="ConvertX contributors"/>
</a>

Licensed under the [GNU AGPL v3](LICENSE), as the upstream project is. Because the AGPL
covers use over a network, anyone running a modified copy as a public service has to offer
that copy's source to its users.
