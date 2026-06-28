# twin net 公式サイト

[twin-net.jimdosite.com](https://twin-net.jimdosite.com/) を参考に再構築した静的ホームページです。

## ページ構成

| ページ | ファイル |
|--------|----------|
| ホーム | `index.html` |
| コンサルティング | `consulting.html` |
| アップデートプロジェクト | `update-project.html` |
| 人間関係にお悩みの方へ | `relationships.html` |
| 自動録音アプリ | `recording-app.html` |
| マイスキル | `my-skills.html` |
| マイストーリー | `my-story.html` |
| お問い合わせ | `contact.html` |
| プライバシーポリシー | `privacy.html` |

## ローカルで確認する

ブラウザで `index.html` を直接開くか、簡易サーバーを起動してください。

```bash
# Python がインストールされている場合
python -m http.server 8000
```

ブラウザで http://localhost:8000 を開きます。

## GitHub へアップロードする手順

### 1. Git をインストール（未インストールの場合）

[Git for Windows](https://git-scm.com/download/win) をダウンロードしてインストールしてください。

### 2. GitHub でリポジトリを作成

1. [GitHub](https://github.com) にログイン
2. 右上の **+** → **New repository**
3. リポジトリ名: `twin-net-website`（任意）
4. **Public** を選択 → **Create repository**

### 3. ファイルをアップロード

PowerShell で以下を実行します（`YOUR_USERNAME` を自分の GitHub ユーザー名に置き換えてください）。

```powershell
cd C:\Users\user\twin-net-website
git init
git add .
git commit -m "Initial commit: twin net website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/twin-net-website.git
git push -u origin main
```

### 4. GitHub Pages で公開（任意）

1. GitHub リポジトリの **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` / `/ (root)`
4. **Save**

数分後、`https://YOUR_USERNAME.github.io/twin-net-website/` で公開されます。

## 技術スタック

- HTML5 / CSS3 / JavaScript（フレームワークなし）
- Google Fonts（Noto Sans JP）
- レスポンシブ対応（スマートフォン・タブレット・PC）

## ライセンス

© 2026 twin net. All rights reserved.
