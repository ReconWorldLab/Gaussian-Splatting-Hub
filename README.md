# GS-Hub

GS-Hub 是一个基于 Astro 和 GitHub Pages 的 3DGS 静态素材库。它不依赖传统后端，素材元数据全部维护在单一 `assets.json` 中，用户通过详情页按钮跳转到外部网盘下载。

## 本地开发

1. 安装 Node.js 24 或更高版本。
2. 运行 `npm install`。
3. 运行 `npm run dev` 启动本地开发服务器。

## 常用命令

- `npm run validate`：校验 `assets.json` 数据结构、重复 `id`、缩略图路径和下载链接。
- `npm test`：执行素材数据校验测试。
- `npm run build`：先校验数据，再构建 Astro 静态站。

## 素材数据

所有素材都维护在 `src/data/assets.json`。

每个素材对象支持以下字段：

- `id`：唯一标识符，必填。
- `title`：素材名称，必填。
- `author`：作者或来源，必填。
- `tags`：标签数组，必填，至少一个。
- `thumbnail`：仓库 `public/` 目录内的缩略图路径，必填。
- `download_url`：外部下载链接，必填，必须是 `https`。
- `summary`：列表页摘要，可选。
- `description`：详情页正文，可选。
- `source`：来源备注，可选。
- `download_note`：提取码或下载说明，可选。
- `preview_model`：为后续网页预览预留的轻量模型地址，可选，v1 不展示。

示例：

```json
{
  "id": "scene-001",
  "title": "赛博朋克小巷",
  "author": "GS-Hub Demo",
  "tags": ["城市", "夜景", "扫描"],
  "thumbnail": "/thumbnails/scene-001.svg",
  "download_url": "https://pan.baidu.com/s/1gs-hub-demo"
}
```

## 更新流程

1. 把缩略图文件放到 `public/` 下。
2. 在 `assets.json` 里追加一条素材记录。
3. 执行 `npm run build` 确认通过。
4. 提交并推送到 `main`。

## GitHub Pages 部署

仓库包含 `.github/workflows/deploy.yml`，推送到 `main` 后会自动：

1. 安装依赖
2. 执行测试
3. 构建 Astro 站点
4. 上传 `dist/`
5. 发布到 GitHub Pages

如果仓库名不是 `<username>.github.io`，工作流会自动把 Astro 的 `base` 设置为 `/<repo-name>/`。

