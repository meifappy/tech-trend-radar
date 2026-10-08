/* Render loop: batches refreshes into one frame and re-lays out on resize. */
let rq = 0, rqHard = false;
function refresh(soft) {
  if (!soft) rqHard = true;
  if (rq) return;
  rq = requestAnimationFrame(() => {
    rq = 0;
    const hard = rqHard;
    rqHard = false;
    derive();
    paintRadar();
    paintChrome();
    renderDock('quiet');
    const pg = cur().page;
    if (pg === 'home' || (hard && pg !== 'brief')) renderPanel(false);
  });
}
function layoutAll() {
  const was = PHONE;
  PHONE = mqPhone.matches;
  WIDE = mqWide.matches && !PHONE;
  if (was !== PHONE) WC.clear();
  size();
  RD.sig = '';
  place();
  qboxes();
  if (!RD.raf) placeLabels();
  if (PHONE) sheetTo(SH.det); else { P.el.style.removeProperty('--sh'); P.el.style.removeProperty('--shpad'); }
  if (RD.dockK !== undefined && RD.dockK !== dockRows()) renderDock();
}
new ResizeObserver(() => layoutAll()).observe(RD.stage);
onMq(mqPhone, () => { layoutAll(); renderPanel(false); });
onMq(mqWide, () => { layoutAll(); afterNav(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { WC.clear(); layoutAll(); });
setInterval(paintChrome, 60000);
