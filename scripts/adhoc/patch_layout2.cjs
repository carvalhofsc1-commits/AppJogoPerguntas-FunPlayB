const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// play-header-bar: menos margem
css = css.replace('  margin-bottom: 0.8rem;\r\n}\r\n\r\n.play-player-info', '  margin-bottom: 0.4rem;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.play-player-info');

// play-score-bar: padding e margem menores
css = css.replace('  padding: 0.5rem 0.8rem;\r\n  margin-bottom: 0.5rem;\r\n}\r\n\r\n.play-score-item', '  padding: 0.25rem 0.7rem;\r\n  margin-bottom: 0.3rem;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.play-score-item');

// play-score-val: fonte menor
css = css.replace('.play-score-val {\r\n  font-size: 1.1rem;', '.play-score-val {\r\n  font-size: 0.9rem;');

// play-clock-wrap: sem margem excessiva
css = css.replace('  margin-bottom: 3.9rem;\r\n  margin-top: 0.0rem;\r\n}', '  margin-bottom: 0;\r\n  margin-top: 0;\r\n  flex-shrink: 0;\r\n}');

// play-clock: 56px
css = css.replace('  width: 64px;\r\n  height: 64px;\r\n  display: grid;\r\n  place-items: center;\r\n}\r\n\r\n.play-triangle', '  width: 56px;\r\n  height: 56px;\r\n  display: grid;\r\n  place-items: center;\r\n}\r\n\r\n.play-triangle');

// play-triangle: origin menor
css = css.replace('  transform-origin: 50% 32px;', '  transform-origin: 50% 28px;');

// play-clock-num: menor
css = css.replace('  font-size: 2.6rem;\r\n  font-weight: 900;\r\n  color: #fff;\r\n  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);\r\n  line-height: 1;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  width: 64px;\r\n  height: 64px;\r\n  margin-top: 28px;', '  font-size: 2.1rem;\r\n  font-weight: 900;\r\n  color: #fff;\r\n  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);\r\n  line-height: 1;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  width: 56px;\r\n  height: 56px;\r\n  margin-top: 24px;');

// play-question-card: padding menor, max-height
css = css.replace('  padding: 1rem;\r\n  margin-bottom: 0.8rem;\r\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);\r\n  text-align: center;\r\n  flex-grow: 1;\r\n  flex-shrink: 1;\r\n  min-height: 120px;', '  padding: 0.6rem 0.8rem;\r\n  margin-bottom: 0.5rem;\r\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);\r\n  text-align: center;\r\n  flex-grow: 1;\r\n  flex-shrink: 1;\r\n  min-height: 70px;\r\n  max-height: 28vh;');

// play-options: gap e margem menores + flex-shrink
css = css.replace('  gap: 0.6rem;\r\n  margin-bottom: 1.5rem;\r\n}', '  gap: 0.3rem;\r\n  margin-bottom: 0.4rem;\r\n  flex-shrink: 0;\r\n}');

// play-option: padding menor
css = css.replace('  border-radius: 16px;\r\n  padding: 0.5rem 0.8rem;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 0.8rem;', '  border-radius: 12px;\r\n  padding: 0.3rem 0.6rem;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 0.5rem;');

// play-option-letter: menor
css = css.replace('  width: 32px;\r\n  height: 32px;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  border-radius: 50%;\r\n  font-weight: 900;\r\n  font-size: 1.1rem;', '  width: 26px;\r\n  height: 26px;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  border-radius: 50%;\r\n  font-weight: 900;\r\n  font-size: 0.85rem;');

// play-option-text: fonte menor
css = css.replace('.play-option-text {\r\n  font-size: 0.95rem;', '.play-option-text {\r\n  font-size: 0.83rem;');

// play-controls: margem menor
css = css.replace('  margin-bottom: 1rem;\r\n}\r\n\r\n.play-ctrl-btn', '  margin-bottom: 0.2rem;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.play-ctrl-btn');

// play-dashboard: margem menor
css = css.replace('  margin: 1rem auto;', '  margin: 0.3rem auto;');

// play-dashboard-score-val: fonte menor
css = css.replace('  font-size: 2.5rem;\r\n  font-weight: 900;\r\n  color: #fff;\r\n  line-height: 1;\r\n  text-shadow: 0 2px 4px rgba(0,0,0,0.3);', '  font-size: 1.8rem;\r\n  font-weight: 900;\r\n  color: #fff;\r\n  line-height: 1;\r\n  text-shadow: 0 2px 4px rgba(0,0,0,0.3);');

// play-diff-badge: margem menor
css = css.replace('  margin-bottom: 0.8rem;\r\n}\r\n\r\n.play-statement', '  margin-bottom: 0.3rem;\r\n}\r\n\r\n.play-statement');

// play-statement: fonte ligeiramente menor
css = css.replace('.play-statement {\r\n  font-size: 1.05rem;', '.play-statement {\r\n  font-size: 0.97rem;');

// play-header-bar: ajuste margem
css = css.replace('.play-header-bar {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  margin-bottom: 0.8rem;\r\n}', '.play-header-bar {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  margin-bottom: 0.3rem;\r\n  flex-shrink: 0;\r\n}');

fs.writeFileSync('src/index.css', css, 'utf8');
console.log('All layout patches applied!');
