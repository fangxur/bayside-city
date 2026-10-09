# 世界著名雕像：模型来源与许可

本目录中的网格为下列开放模型的游戏优化版本。原作雕塑不由本项目创作；模型作者与机构未为本游戏背书。模型许可独立于项目代码的 MIT 许可。

| 游戏雕像 / 文件 | 数字模型作者与来源 | 许可 |
| --- | --- | --- |
| 大卫雕像 / `david.js` | [David by Michelangelo — Jerry Fisher (jerryfisher)](https://sketchfab.com/3d-models/david-by-michelangelo-8f4827cf36964a17b90bad11f48298ac)，Sioux Falls 的全尺寸青铜复制像扫描；通过 [Objaverse 公开镜像](https://huggingface.co/datasets/allenai/objaverse/blob/main/glbs/000-018/8f4827cf36964a17b90bad11f48298ac.glb) 获取。 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| 断臂维纳斯 / `venus.js` | 丹麦国立美术馆 SMK，Venus de Milo；通过 [IIIF 3D fixtures 的模型及许可记录](https://fixtures.iiif.io/info.html?file=%2F3d%2Fsmk%2Fvenus.glb) 获取。 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| 萨莫色雷斯胜利女神 / `victory.js` | [Winged Victory of Samothrace — Cosmo Wenman](https://sketchfab.com/3d-models/winged-victory-of-samothrace-4edd6459f2834e7ab0b395e71cee2513)，Skulpturhalle Basel 复制像扫描；FBX 取自 [VR-Portfolio-2 的署名模型镜像](https://github.com/jke48222/VR-Portfolio-2/blob/main/Demo1_VR_Locomotion/README.md)。 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)（镜像所标注的 Sketchfab 发布版本） |
| 掷铁饼者 / `discobolus.js` | 丹麦国立美术馆 SMK，[KAS1074](https://open.smk.dk/en/artwork/image/KAS1074)，重建为朝持盘手方向回头的版本；[公开 STL](https://api.smk.dk/api/v1/download-3d/t148fn71j_KAS1074_small.stl)。 | SMK 标注 [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/)，数字开放素材政策见 [SMK 3D models](https://www.smk.dk/en/article/3d-models/)。 |

## 本项目修改

- 合并网格，焊接重复顶点，简化为每款约 14,000–18,000 个三角形。
- 调整坐标轴、展示朝向和重心；游戏中将人物、基座和庭园等比例缩放，适配 1×1 地块。
- 去除原纹理，使用游戏内石材和灯光；重新计算平滑法线，并以顶点颜色保存柔和的环境遮蔽阴影。
- 位置量化为 16 位，和三角形索引、8 位阴影值一同编码在本地 JavaScript 模块中；运行时无需连接外部模型平台。
- 游戏新增的广场铺装、石台、铭牌、绿植与投光灯由本项目绘制。

重新分发游戏或这些网格时请保留本文件以及游戏中「雕像模型来源与许可」的链接。优化步骤见 `../../tools/optimize-sculptures.py`。
