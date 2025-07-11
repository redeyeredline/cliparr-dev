// Alphabet navigation sidebar with dynamic sizing and ellipsis truncation for large datasets.
// Provides clickable letter navigation with responsive font sizing and overflow handling.
import { useRef, useEffect, useState } from 'react';

const MIN_LETTERS_TOP = 3;
const MIN_LETTERS_BOTTOM = 3;
const MAX_FONT = 16;
const MIN_FONT = 12;
const MAX_PADDING = 5;
const MIN_PADDING = 1;
const ELLIPSIS = '…';

const sidebarStyle = {
  width: 44,
  background: '#23272b',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  borderLeft: '1px solid #222',
  userSelect: 'none',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  minHeight: 0,
} as const;

interface LetterStyleProps {
  active: boolean;
  fontSize: number;
  padding: number;
}

function getLetterStyle({ active: _active, fontSize, padding }: LetterStyleProps) {
  return {
    fontSize,
    fontWeight: 700,
    margin: `${padding / 2}px 0`,
    padding: `${padding}px 0`,
    opacity: 0.7,
    color: '#b0b8c1',
    cursor: 'pointer',
    borderRadius: 6,
    background: 'none',
    boxShadow: 'none',
    transition: 'background 0.2s, color 0.2s, opacity 0.2s',
    width: 32,
    textAlign: 'center',
    lineHeight: `${fontSize + 2}px`,
    letterSpacing: 1,
  } as const;
}

function getEllipsisStyle(fontSize: number) {
  return {
    fontSize: fontSize + 2,
    color: '#888',
    margin: '2px 0',
    padding: '2px 0',
    width: 32,
    textAlign: 'center',
    pointerEvents: 'none',
    userSelect: 'none',
  } as const;
}

interface AlphabetSidebarProps {
  onLetterClick?: (letter: string) => void;
  activeLetter?: string | null;
  letters?: string[];
}

export default function AlphabetSidebar({
  onLetterClick,
  activeLetter,
  letters = [],
}: AlphabetSidebarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxLetters, setMaxLetters] = useState(letters.length);
  const [fontSize, setFontSize] = useState(MAX_FONT);
  const [padding, setPadding] = useState(MAX_PADDING);

  useEffect(() => {
    function updateMax() {
      if (ref.current) {
        const height = ref.current.offsetHeight;
        // Try to fit all letters by shrinking font and padding
        let bestFont = MAX_FONT;
        let bestPad = MAX_PADDING;
        let found = false;
        for (let f = MAX_FONT; f >= MIN_FONT; f--) {
          for (let p = MAX_PADDING; p >= MIN_PADDING; p--) {
            const letterHeight = f + 2 + 2 * p; // font + line + padding
            if (letters.length * letterHeight <= height) {
              bestFont = f;
              bestPad = p;
              found = true;
              break;
            }
          }
          if (found) {
            break;
          }
        }
        setFontSize(found ? bestFont : MIN_FONT);
        setPadding(found ? bestPad : MIN_PADDING);
        // If even at min size not all fit, use ellipsis logic
        const minLetterHeight = MIN_FONT + 2 + 2 * MIN_PADDING;
        const maxL = Math.floor(height / minLetterHeight);
        setMaxLetters(maxL);
      }
    }
    updateMax();
    window.addEventListener('resize', updateMax);
    return () => window.removeEventListener('resize', updateMax);
  }, [letters.length]);

  let displayLetters = letters;
  let useFont = fontSize;
  let usePad = padding;
  if (letters.length > maxLetters) {
    // When truncating, always use minimum font and padding
    useFont = MIN_FONT;
    usePad = MIN_PADDING;
    const topCount = Math.max(MIN_LETTERS_TOP, Math.floor((maxLetters - 1) / 2));
    const bottomCount = Math.max(MIN_LETTERS_BOTTOM, maxLetters - topCount - 1);
    displayLetters = [
      ...letters.slice(0, topCount),
      ELLIPSIS,
      ...letters.slice(-bottomCount),
    ];
  }

  // Center the bar vertically if there's extra space
  const totalHeight = displayLetters.length * (useFont + 2 + 2 * usePad);
  const justify = totalHeight < (ref.current?.offsetHeight ?? 0) ? 'center' : 'flex-start';

  return (
    <div ref={ref} style={{ ...sidebarStyle, justifyContent: justify }}>
      {displayLetters.map((letter, idx) =>
        letter === ELLIPSIS ? (
          <div key={idx} style={getEllipsisStyle(useFont)}>{ELLIPSIS}</div>
        ) : (
          <div
            key={letter}
            style={getLetterStyle({
              active: activeLetter === letter,
              fontSize: useFont,
              padding: usePad,
            })}
            onClick={() => onLetterClick?.(letter)}
            onMouseDown={(e) => e.preventDefault()}
          >
            {letter}
          </div>
        ),
      )}
    </div>
  );
}
