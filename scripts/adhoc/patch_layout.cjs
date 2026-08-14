const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// 1. play-screen: height fixo, sem overflow, padding menor
css = css.replace(
  /\.play-screen \{[\s\S]*?margin: 0 auto;\n\}/,
  `.play-screen {
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  background: linear-gradient(160deg, #7b3fa0 0%, #9b59b6 50%, #c39bd3 100%);
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.7rem;
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;
}`
);

// 2. play-header-bar: menos margem, flex-shrink
css = css.replace(
  /\.play-header-bar \{[\s\S]*?margin-bottom: 0\.8rem;\n\}/,
  `.play-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
  flex-shrink: 0;
}`
);

// 3. play-score-bar: padding menor, margem menor
css = css.replace(
  /\.play-score-bar \{[\s\S]*?margin-bottom: 0\.5rem;\n\}/,
  `.play-score-bar {
  display: flex;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  padding: 0.25rem 0.7rem;
  margin-bottom: 0.3rem;
  flex-shrink: 0;
}`
);

// 4. play-score-val: font menor
css = css.replace(
  /\.play-score-val \{\n  font-size: 1\.1rem;/,
  '.play-score-val {\n  font-size: 0.95rem;'
);

// 5. play-clock-wrap: sem margem excessiva
css = css.replace(
  /\.play-clock-wrap \{[\s\S]*?margin-top: 0\.0rem;\n\}/,
  `.play-clock-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 0;
  margin-top: 0;
  flex-shrink: 0;
}`
);

// 6. play-clock: tamanho menor
css = css.replace(
  /\.play-clock \{\n  position: relative;\n  width: 64px;\n  height: 64px;/,
  '.play-clock {\n  position: relative;\n  width: 56px;\n  height: 56px;'
);

// 7. play-clock-num: font menor, tamanho menor
css = css.replace(
  /\.play-clock-num \{[\s\S]*?margin-top: 28px;\n\}/,
  `.play-clock-num {
  z-index: 2;
  font-size: 2.2rem;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-top: 24px;
}`
);

// 8. play-question-card: menor padding, max-height para não explodir
css = css.replace(
  /\.play-question-card \{[\s\S]*?min-height: 120px;/,
  `.play-question-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 14px;
  padding: 0.6rem 0.8rem;
  margin-bottom: 0.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  text-align: center;
  flex-grow: 1;
  flex-shrink: 1;
  min-height: 80px;
  max-height: 30vh;`
);

// 9. play-options: gap menor, margem menor
css = css.replace(
  /\.play-options \{[\s\S]*?margin-bottom: 1\.5rem;\n\}/,
  `.play-options {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}`
);

// 10. play-option: padding menor, border-radius menor
css = css.replace(
  /\.play-option \{[\s\S]*?border-radius: 16px;\n  padding: 0\.5rem 0\.8rem;[\s\S]*?text-align: left;\n\}/,
  `.play-option {
  background: rgba(255, 255, 255, 0.12);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 0.35rem 0.7rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  flex-shrink: 0;
}`
);

// 11. play-option-letter: menor
css = css.replace(
  /\.play-option-letter \{[\s\S]*?width: 32px;\n  height: 32px;/,
  `.play-option-letter {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  width: 26px;
  height: 26px;`
);
css = css.replace(
  /\.play-option-letter \{[\s\S]*?font-size: 1\.1rem;/,
  (m) => m.replace('font-size: 1.1rem;', 'font-size: 0.9rem;')
);

// 12. play-option-text: fonte menor
css = css.replace(
  /\.play-option-text \{\n  font-size: 0\.95rem;/,
  '.play-option-text {\n  font-size: 0.85rem;'
);

// 13. play-controls: margem menor
css = css.replace(
  /\.play-controls \{[\s\S]*?margin-bottom: 1rem;\n\}/,
  `.play-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
  flex-shrink: 0;
}`
);

// 14. play-dashboard: margem menor
css = css.replace(
  /\.play-dashboard \{[\s\S]*?margin: 1rem auto;/,
  (m) => m.replace('margin: 1rem auto;', 'margin: 0.4rem auto;')
);

// 15. play-dashboard-score-val: fonte menor
css = css.replace(
  /\.play-dashboard-score-val \{[\s\S]*?font-size: 2\.5rem;/,
  (m) => m.replace('font-size: 2.5rem;', 'font-size: 2rem;')
);

fs.writeFileSync('src/index.css', css, 'utf8');
console.log('Done! CSS updated for no-scroll layout.');
