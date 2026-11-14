/* 空天工具合集 · 界面规整
   目的：
   1. 并列按钮高亮收敛——同一组按钮里只有语义上的主操作（确认 / 提交 / 保存等）
      保留 .btn.primary 的高亮，其余同级按钮一律退为普通样式；
   2. 工具面板是异步渲染的（合并标签、依赖下载后重建），用 MutationObserver 持续生效。 */

/* 允许保留高亮的动词 */
const STRONG = /(确认|确定|提交|保存|应用|同意|继续|开始|运行|执行|生成|转换|计算|解析|导出|下载|上传|创建|新增|校验|检查|合并|安装|发送|导入|开始处理|立即)/;
/* 明确不该高亮的动作（即使它是组里第一个） */
const WEAK = /(取消|撤销|清空|重置|删除|移除|复制|粘贴|关闭|停止|暂停|刷新|重载|预览|示例|随机|批量|查看|详情|更多|帮助|说明|返回|退出|还原|对比|切换|选择|设为|默认)/;

function labelOf(btn) {
  return (btn.textContent || '').replace(/\s+/g, '').trim();
}

function keepHighlight(btn) {
  const t = labelOf(btn);
  if (!t) return false;
  if (WEAK.test(t)) return false;
  return STRONG.test(t);
}

/* 把同一父级下的并列按钮做一次收敛；重复调用是幂等的 */
export function normalizeActionButtons(root) {
  if (!root || !root.querySelectorAll) return;
  const groups = new Map();
  root.querySelectorAll('.btn').forEach((btn) => {
    const parent = btn.parentElement;
    if (!parent) return;
    const arr = groups.get(parent) || [];
    arr.push(btn);
    groups.set(parent, arr);
  });

  groups.forEach((list) => {
    // 只有真正并列（同一容器里至少两个按钮）时才需要压制高亮
    if (list.length < 2) {
      const only = list[0];
      if (only.classList.contains('primary') && !keepHighlight(only)) only.classList.remove('primary');
      return;
    }
    let kept = false;
    list.forEach((btn) => {
      if (!btn.classList.contains('primary')) return;
      if (!kept && keepHighlight(btn)) {
        kept = true;
        return;
      }
      btn.classList.remove('primary');
    });
  });
}

/* 挂载观察器；返回解除函数 */
export function watchActionButtons(root) {
  if (!root) return null;
  normalizeActionButtons(root);
  if (root.__ktPolish) return null;
  root.__ktPolish = true;
  let timer = 0;
  const mo = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = 0;
      normalizeActionButtons(root);
    }, 60);
  });
  mo.observe(root, { childList: true, subtree: true });
  return () => {
    if (timer) clearTimeout(timer);
    mo.disconnect();
    root.__ktPolish = false;
  };
}
