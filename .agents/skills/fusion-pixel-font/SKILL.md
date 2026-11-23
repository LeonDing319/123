---
name: fusion-pixel-font
description: 在「阅读器」项目中设计或实现缝合像素字体（Fusion Pixel Font）排版。用于明确要求像素字体、中文点阵字、复古阅读器标题、标签或界面控件时。
---

# 缝合像素字体

先看项目现有的 `app/globals.css` 和相关组件，确定哪些文字需要像素风。优先把点阵字用在标题、标签和短控件上。长文阅读可沿用项目正文栈，除非用户想把正文也做成点阵风格。

## 选择字形

- 中文界面优先试 12 像素比例版 `zh-Hans`。需要严格对齐的页码、计数或网格标签可试等宽版。按内容语言选字形版本。
- 先以原生点阵尺寸和整数倍试排，例如 12px、24px。用项目里的中文、标点、数字和中英混排检查清晰度、基线、回退字形及窄屏换行。
- 用附带的 [8 像素](assets/preview-8px.png)、[10 像素](assets/preview-10px.png) 和 [12 像素](assets/preview-12px.png) 样张比较字形。接入后以实际页面渲染为准。

## 接入项目

- 随附的 [原始源码包](assets/fusion-pixel-font-master.zip) 保留上游源码、字形素材和构建配置。Web 接入时从[上游发布页](https://github.com/TakWolf/fusion-pixel-font/releases) 选择相应尺寸、宽度和语言的成品 WOFF2。源码包 `assets/fonts` 内的字体是构建素材。
- 把所选成品文件放在应用能打包或提供的路径，通过 `@font-face` 或项目已有的本地字体机制加载。将字体应用到需要像素风的组件，并保留系统字体回退。
- 随成品字体保留对应的上游 OFL 许可和版权声明。随附源码包的两份许可证也可单独查阅：[字体 OFL](assets/LICENSE-OFL)、[构建程序 MIT](assets/LICENSE-MIT)。
