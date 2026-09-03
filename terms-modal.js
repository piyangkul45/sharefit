'use strict';

/*
 * LoopWear — shared Terms & Privacy accordion modal.
 *
 * The section copy below is mirrored from terms.html — keep the two in sync.
 *
 * Usage:
 *   1. <script src="/terms-modal.js"></script>  (before the page's own script)
 *   2. Add `data-open-terms` to any <button> or <a>; clicking it opens the modal.
 *      Optional value = section to expand: privacy | tos | dispute | fraud
 *      e.g. <button type="button" data-open-terms="tos">ข้อตกลงการใช้งาน</button>
 *   3. Or call window.LoopWearTerms.open('tos') / .close() directly.
 *
 * Without JS the `data-open-terms` anchors still navigate to /terms.html.
 */
(function () {
  if (window.LoopWearTerms) return;

  const CONSENT_VERSION = '2026-09-03';

  const SECTIONS = [
    {
      id: 'privacy', th: 'นโยบายความเป็นส่วนตัว', en: 'Privacy Policy',
      body: `
        <p>LoopWear เก็บรวบรวมข้อมูลส่วนบุคคลของท่านเท่าที่จำเป็นต่อการให้บริการแพลตฟอร์มเช่าและซื้อขายเสื้อผ้า ได้แก่ ชื่อ–นามสกุล ที่อยู่อีเมล หมายเลขโทรศัพท์ รูปถ่ายสินค้า ที่อยู่จัดส่ง ข้อมูลการชำระเงิน และประวัติการทำรายการ</p>
        <p><strong>วัตถุประสงค์ในการใช้ข้อมูล:</strong> เพื่อยืนยันตัวตน ดำเนินการเช่าและซื้อขาย ประสานงานระหว่างผู้ใช้ ป้องกันการฉ้อโกง และปรับปรุงคุณภาพบริการ</p>
        <p><strong>การเปิดเผยข้อมูล:</strong> เราเปิดเผยเฉพาะข้อมูลที่จำเป็น เช่น ชื่อผู้ใช้ ช่องทางติดต่อ และที่อยู่จัดส่ง ให้แก่คู่สัญญาอีกฝ่ายในรายการที่ท่านทำ รวมถึงผู้ให้บริการชำระเงินและขนส่งที่เกี่ยวข้องเท่านั้น</p>
        <p><strong>ระยะเวลาจัดเก็บ:</strong> เราเก็บข้อมูลตราบเท่าที่บัญชีของท่านยังใช้งานอยู่ และไม่เกิน 1 ปีหลังปิดบัญชี เว้นแต่กฎหมายกำหนดเป็นอย่างอื่น</p>
        <p><strong>สิทธิของเจ้าของข้อมูล:</strong> ท่านมีสิทธิเข้าถึง ขอสำเนา แก้ไข ลบ โอนย้าย คัดค้าน หรือระงับการใช้ข้อมูล และเพิกถอนความยินยอมได้ทุกเมื่อ โดยติดต่อ privacy@loopwear.co ทั้งนี้การเพิกถอนความยินยอมอาจทำให้ไม่สามารถใช้บริการบางส่วนได้</p>`,
    },
    {
      id: 'tos', th: 'ข้อตกลงการใช้งาน', en: 'Terms of Service',
      body: `
        <p>ผู้ใช้บริการต้องมีอายุ 18 ปีบริบูรณ์ขึ้นไป และรับผิดชอบต่อความถูกต้องของข้อมูลบัญชี รวมถึงการเก็บรักษารหัสผ่านของตนเอง</p>
        <p>LoopWear เป็นเพียงตัวกลางเชื่อมโยงระหว่างผู้ให้เช่า/ผู้ขาย กับผู้เช่า/ผู้ซื้อ สัญญาเช่าหรือซื้อขายเกิดขึ้นโดยตรงระหว่างผู้ใช้ทั้งสองฝ่าย</p>
        <p><strong>การเช่า:</strong> ผู้เช่าต้องส่งคืนสินค้าในสภาพเดิมภายในกำหนด หากล่าช้าหรือชำรุดเสียหาย ผู้เช่าต้องรับผิดชอบค่าปรับหรือค่าเสียหายตามที่ระบุไว้ในรายการ</p>
        <p><strong>การซื้อขาย:</strong> กรรมสิทธิ์ในสินค้าจะโอนไปยังผู้ซื้อเมื่อมีการชำระเงินครบถ้วนและผู้ขายได้จัดส่งสินค้าแล้ว</p>
        <p>ผู้ลงประกาศต้องเป็นเจ้าของสินค้าโดยชอบด้วยกฎหมาย ห้ามลงประกาศสินค้าผิดกฎหมาย สินค้าลอกเลียนแบบ หรือสินค้าที่ละเมิดทรัพย์สินทางปัญญา</p>
        <p>LoopWear อาจเรียกเก็บค่าธรรมเนียมบริการจากรายการที่ทำสำเร็จ โดยจะแสดงจำนวนให้ทราบก่อนการยืนยันรายการทุกครั้ง</p>`,
    },
    {
      id: 'dispute', th: 'กฎการระงับข้อพิพาท', en: 'Dispute Rules',
      body: `
        <p>หากเกิดปัญหาจากรายการเช่าหรือซื้อขาย ผู้ใช้ต้องแจ้งเรื่องผ่านระบบภายใน 3 วัน นับจากวันที่ได้รับสินค้าหรือวันครบกำหนดคืน</p>
        <p>ผู้ใช้ควรเก็บหลักฐานประกอบ เช่น รูปถ่ายสินค้าก่อนและหลังใช้งาน ข้อความสนทนาภายในระบบ และหลักฐานการจัดส่ง</p>
        <p>LoopWear จะทำหน้าที่ไกล่เกลี่ยโดยพิจารณาจากหลักฐานของทั้งสองฝ่าย และอาจกำหนดให้มีการคืนเงิน ชดใช้ค่าเสียหาย หรือหักค่าปรับตามความเหมาะสม</p>
        <p>กรณีสินค้าสูญหายหรือเสียหายจนไม่สามารถซ่อมแซมได้ ผู้เช่าอาจต้องรับผิดชอบตามมูลค่าทดแทนของสินค้าที่ระบุไว้ในรายการ</p>
        <p>คำตัดสินของทีมระงับข้อพิพาทถือเป็นที่สิ้นสุดภายในแพลตฟอร์ม โดยไม่ตัดสิทธิ์ผู้ใช้ในการดำเนินการตามกฎหมาย</p>`,
    },
    {
      id: 'fraud', th: 'นโยบายต่อต้านการฉ้อโกง', en: 'Anti-Fraud Policy',
      body: `
        <p>ห้ามผู้ใช้ทำธุรกรรมนอกแพลตฟอร์มเพื่อหลีกเลี่ยงค่าธรรมเนียมหรือระบบคุ้มครองผู้ใช้</p>
        <p>ห้ามสร้างบัญชีปลอม ใช้ตัวตนของผู้อื่น หรือให้ข้อมูลอันเป็นเท็จในการยืนยันตัวตน</p>
        <p>ห้ามลงประกาศสินค้าที่ไม่มีอยู่จริง สินค้าไม่ตรงตามคำอธิบาย หรือใช้รูปภาพที่ทำให้เข้าใจผิด</p>
        <p>LoopWear อาจขอเอกสารยืนยันตัวตน (KYC) ตรวจสอบรายการที่น่าสงสัย ระงับการจ่ายเงิน หรืออายัดบัญชีชั่วคราวเพื่อป้องกันความเสียหาย</p>
        <p>การกระทำที่เข้าข่ายฉ้อโกงจะส่งผลให้ถูกระงับบัญชีถาวร และอาจถูกดำเนินคดีตามกฎหมาย ท่านสามารถแจ้งเบาะแสได้ที่ trust@loopwear.co โดยข้อมูลผู้แจ้งจะถูกเก็บเป็นความลับ</p>`,
    },
  ];

  const CSS = `
    #lw-terms-overlay {
      position: fixed; inset: 0; z-index: 9998; display: none;
      align-items: center; justify-content: center; padding: 1.5rem;
      background: rgba(0,0,0,0.72); backdrop-filter: blur(4px);
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    #lw-terms-overlay.open { display: flex; }

    #lw-terms-overlay .lw-tm-dialog {
      width: min(680px, 100%); max-height: min(82vh, 760px);
      display: flex; flex-direction: column;
      background: #111111; color: #f5f5f5;
      border: 1px solid #2e2e2e; border-radius: 1rem; overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    }
    #lw-terms-overlay .lw-tm-head {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 1.25rem 1.4rem; border-bottom: 1px solid #2e2e2e; flex-shrink: 0;
    }
    #lw-terms-overlay .lw-tm-head h2 {
      font-size: 1.05rem; font-weight: 800; letter-spacing: -0.3px; margin: 0;
    }
    #lw-terms-overlay .lw-tm-close {
      flex-shrink: 0; width: 2rem; height: 2rem;
      background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 50%; color: #737373; font-size: 1.15rem; line-height: 1;
      cursor: pointer; transition: background 0.2s, color 0.2s;
    }
    #lw-terms-overlay .lw-tm-close:hover { background: rgba(255,255,255,0.14); color: #f5f5f5; }

    #lw-terms-overlay .lw-tm-body { padding: 1.25rem 1.4rem; overflow-y: auto; }

    #lw-terms-overlay .lw-tm-acc {
      border: 1px solid #2e2e2e; border-radius: 0.7rem;
      background: #141414; overflow: hidden;
    }
    #lw-terms-overlay .lw-tm-acc + .lw-tm-acc { margin-top: 0.7rem; }
    #lw-terms-overlay .lw-tm-acc summary {
      list-style: none; cursor: pointer; user-select: none; padding: 0.95rem 1.1rem;
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
    }
    #lw-terms-overlay .lw-tm-acc summary::-webkit-details-marker { display: none; }
    #lw-terms-overlay .lw-tm-acc summary:hover { background: rgba(255,255,255,0.03); }
    #lw-terms-overlay .lw-tm-acc summary:focus-visible { outline: 2px solid #555; outline-offset: -2px; }
    #lw-terms-overlay .lw-tm-acc-title { font-weight: 700; font-size: 0.95rem; }
    #lw-terms-overlay .lw-tm-acc-en {
      display: block; margin-top: 0.15rem; font-size: 0.72rem; font-weight: 500;
      letter-spacing: 0.04em; text-transform: uppercase; color: #737373;
    }
    #lw-terms-overlay .lw-tm-chevron {
      flex-shrink: 0; width: 0.6rem; height: 0.6rem; margin-top: 0.35rem;
      border-right: 2px solid #737373; border-bottom: 2px solid #737373;
      transform: rotate(-45deg); transition: transform 0.2s;
    }
    #lw-terms-overlay .lw-tm-acc[open] .lw-tm-chevron { transform: rotate(45deg); }
    #lw-terms-overlay .lw-tm-acc-body {
      padding: 0.25rem 1.1rem 1.1rem; color: #cfcfcf; font-size: 0.88rem; line-height: 1.75;
    }
    #lw-terms-overlay .lw-tm-acc-body p { margin: 0 0 0.65rem; }
    #lw-terms-overlay .lw-tm-acc-body p:last-child { margin-bottom: 0; }
    #lw-terms-overlay .lw-tm-acc-body strong { color: #f5f5f5; font-weight: 600; }

    @media (max-width: 560px) {
      #lw-terms-overlay { padding: 0; }
      #lw-terms-overlay .lw-tm-dialog { max-height: 100%; height: 100%; border-radius: 0; border: none; }
    }
  `;

  let overlay, dialog, closeBtn, lastFocus = null, bodyOverflowBefore = '';

  function build() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.id = 'lw-terms-overlay';
    overlay.innerHTML =
      '<div class="lw-tm-dialog" role="dialog" aria-modal="true" aria-labelledby="lw-tm-title">' +
        '<div class="lw-tm-head">' +
          '<h2 id="lw-tm-title">ข้อกำหนดและนโยบายความเป็นส่วนตัว</h2>' +
          '<button type="button" class="lw-tm-close" aria-label="ปิด">&times;</button>' +
        '</div>' +
        '<div class="lw-tm-body">' +
          SECTIONS.map((s, i) =>
            `<details class="lw-tm-acc" data-section="${s.id}"${i === 0 ? ' open' : ''}>` +
              '<summary>' +
                `<span class="lw-tm-acc-title">${s.th}<span class="lw-tm-acc-en">${s.en}</span></span>` +
                '<span class="lw-tm-chevron" aria-hidden="true"></span>' +
              '</summary>' +
              `<div class="lw-tm-acc-body">${s.body}</div>` +
            '</details>'
          ).join('') +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    dialog   = overlay.querySelector('.lw-tm-dialog');
    closeBtn = overlay.querySelector('.lw-tm-close');

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const focusable = dialog.querySelectorAll('button, summary, a[href], [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open(sectionId) {
    if (!overlay) build();
    lastFocus = document.activeElement;
    if (sectionId) {
      overlay.querySelectorAll('.lw-tm-acc').forEach(d => {
        d.open = d.dataset.section === sectionId;
      });
    }
    overlay.classList.add('open');
    bodyOverflowBefore = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = bodyOverflowBefore;
    document.removeEventListener('keydown', onKey);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  // Capture phase so it still fires inside modals that call stopPropagation()
  // on their own container (e.g. the marketplace booking modal).
  document.addEventListener('click', (e) => {
    const trigger = e.target && e.target.closest && e.target.closest('[data-open-terms]');
    if (!trigger) return;
    e.preventDefault();
    e.stopPropagation();
    open(trigger.getAttribute('data-open-terms') || null);
  }, true);

  window.LoopWearTerms = { open, close, CONSENT_VERSION };
})();
