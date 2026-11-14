/* 主题取色：让 canvas / SVG 绘制随亮暗主题切换，避免亮色下白底白字 */

export const isLightTheme = () => document.documentElement.dataset.theme === 'light';

export const themeTone = (light, dark) => (isLightTheme() ? light : dark);

export const cssColor = (name, fallback) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (e) {
    return fallback;
  }
};

/* 主文字 / 次要文字 */
export const inkText = () => themeTone('#0e1a2f', '#e9eefc');
export const inkMuted = () => themeTone('#5a6880', '#8b9bb8');
/* 分割线：暗色用白色低透明度，亮色用墨色低透明度 */
export const inkLine = (dark = 0.1, light = 0.16) =>
  themeTone(`rgba(16,32,58,${light})`, `rgba(255,255,255,${dark})`);
/* 面板底（用于在画布上铺一层与主题一致的底色） */
export const inkPanel = () => themeTone('#ffffff', '#0b1220');
