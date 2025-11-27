# OB English Learner - 文件结构

## 📁 核心文件

### 插件运行文件
- `main.js` - 编译后的插件代码（生产环境）
- `manifest.json` - 插件清单（版本、名称、描述）
- `styles.css` - 插件样式
- `data.json` - 用户配置数据

### 源代码
- `main.ts` - 主入口文件
- `src/` - 源代码目录
  - `generator.ts` - 笔记生成器
  - `scraper.ts` - YouTube 数据抓取
  - `bilibili-scraper.ts` - Bilibili 数据抓取
  - `parser.ts` - 字幕解析器
  - `translator.ts` - AI 翻译/格式化
  - `bases.ts` - Bases 集成
  - `password-manager.ts` - 密码管理
  - `progress-notice.ts` - 进度提示
  - `types.ts` - TypeScript 类型定义
  - `youtube-transcript-direct.ts` - YouTube 字幕直接获取

## 📦 构建文件

- `package.json` - NPM 包配置
- `package-lock.json` - NPM 依赖锁定
- `tsconfig.json` - TypeScript 配置
- `esbuild.config.mjs` - 构建配置
- `version-bump.mjs` - 版本更新脚本
- `versions.json` - 版本历史

## 📝 文档文件

- `README.md` - 插件说明文档
- `CHANGELOG.md` - 更新日志
- `LICENSE` - 开源协议

## 🔧 开发配置

- `.editorconfig` - 编辑器配置
- `.eslintrc` - ESLint 配置
- `.eslintignore` - ESLint 忽略规则
- `.gitignore` - Git 忽略规则
- `.npmrc` - NPM 配置

## 📦 发布文件

- `release.zip` - 发布包（包含 main.js, manifest.json, styles.css）

## 🗂️ 目录说明

### `.git/`
Git 版本控制目录

### `node_modules/`
NPM 依赖包（开发时需要，不包含在发布包中）

### `src/`
TypeScript 源代码（编译为 main.js）

---

## 🚀 使用说明

### 开发模式
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

### 版本更新
```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

---

**版本**: v1.0.2  
**最后更新**: 2025-11-27
