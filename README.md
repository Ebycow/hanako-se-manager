# はなこSEリスト

Discord の読み上げ bot「[読み上げ花子](https://github.com/Ebycow/hanako)」に登録された SE（サウンドエフェクト）の名前を一覧表示する Web ページです。

- SE 名をクリックするとクリップボードにコピーされます
- 検索ボックスで絞り込めます（`?q=キーワード` 付きの URL で、検索した状態から開けます）
- 先頭の文字列が同じ SE は自動でグループ分けされ、同じ系統の色で表示されます

## しくみ

hanako の `soundeffect.db`（nedb 形式）を **読み取り専用** で読み、指定した Discord サーバーに登録された SE 名を返します。
nedb ライブラリは読み込み時にファイルを書き直すため使わず、ファイルを直接パースしています。DB ファイルが更新されたときだけ読み直します。

依存パッケージはなく、Node.js 標準の `http` モジュールだけで動きます。

| パス | 内容 |
| --- | --- |
| `/` | 一覧ページ |
| `/se` | SE 名の一覧（JSON: `{ "names": [...] }`） |
| `/healthz` | ヘルスチェック |

## 使い方（Docker Compose）

hanako の DB が Docker ボリューム `hanako_db` にある前提です。

```sh
cp .env.example .env
# .env の SELIST_SERVER_ID に、一覧を表示する Discord サーバーの ID を書く
docker compose up -d --build
```

`compose.yaml` はホストにポートを公開しません。リバースプロキシ経由で公開する場合は、`compose.override.yaml` でプロキシと同じネットワークにつないでください。

```yaml
# compose.override.yaml の例
services:
  selist:
    networks:
      - proxy_net

networks:
  proxy_net:
    external: true
```

プロキシからは `http://selist:8750` で届きます。サブパス（例: `/selist/`）で公開する場合は、プロキシ側でプレフィックスを外して転送してください。ページ内のリンクはすべて相対パスです。

直接ポートを開ける場合は、`compose.override.yaml` に `ports: ["8750:8750"]` を書きます。

## 環境変数

| 名前 | 既定値 | 内容 |
| --- | --- | --- |
| `SELIST_SERVER_ID` | （必須） | 一覧を表示する Discord サーバーの ID |
| `SELIST_DB_FILE` | `/data/soundeffect.db` | hanako の SE DB のパス |
| `PORT` | `8750` | 待ち受けポート |

## Docker を使わずに動かす

Node.js 18 以降で動きます。

```sh
SELIST_SERVER_ID=123456789012345678 SELIST_DB_FILE=/path/to/soundeffect.db node app.js
```
