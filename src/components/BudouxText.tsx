import { Fragment } from "react";
import { loadDefaultJapaneseParser } from "budoux";

// BudouX パーサーはモジュール読み込み時に一度だけ生成（毎レンダーで作らない）。
const parser = loadDefaultJapaneseParser();

/**
 * 日本語テキストを文節単位で改行させるラッパー。
 * BudouX で分割した各文節を <wbr>（改行可能位置）で連結し、
 * CSS 側（.budoux）の word-break: keep-all と組み合わせて
 * 「文節の途中では折り返さない」自然な改行を全ブラウザ（Safari 含む）で実現する。
 */
export default function BudouxText({ children }: { children: string }) {
  const segments = parser.parse(children);
  return (
    <span className="budoux">
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {seg}
        </Fragment>
      ))}
    </span>
  );
}
