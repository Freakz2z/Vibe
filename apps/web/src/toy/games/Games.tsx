import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ChevronLeft,
  Flame,
  LockKeyhole,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import {
  QUIZ_SCENARIOS,
  scenarioById,
} from "../../../../../shared/quiz/scenarios";
import { routeHref } from "../../lib/runtime";
import { supports } from "../sdk";
import { HumanCheck } from "./Turnstile";
import {
  errorMessage,
  gameRequest,
  type Answer,
  type GameConfig,
  type Pack,
} from "./client";
import { PagedCopy, useGameViewport } from "./Screen";
import "./games.css";
type Pose = "ready" | "good" | "oops" | "think" | "win" | "sleep";
function Robot({
  pose = "ready",
  className = "",
}: {
  pose?: Pose;
  className?: string;
}) {
  return (
    <span
      className={"quiz-robot " + className}
      data-pose={pose}
      role="img"
      aria-label={
        {
          ready: "拿着清单的 AI 同事",
          good: "AI 同事点赞",
          oops: "AI 同事有点心虚",
          think: "AI 同事正在思考",
          win: "AI 同事庆祝",
          sleep: "AI 同事喝咖啡",
        }[pose]
      }
    />
  );
}
function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    const j = value % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function authoredPack(): Pack {
  return {
    id: "practice-" + Date.now(),
    source: "authored",
    rounds: shuffled(QUIZ_SCENARIOS).slice(0, 5),
  };
}
function useFollowGate() {
  const [state, setState] = useState<
    "checking" | "locked" | "open" | "unavailable"
  >("checking");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const check = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setState((previous) => (previous === "open" ? "open" : "checking"));
    setMessage("");
    try {
      if (!(await supports("getAuthorRelation"))) {
        setState("unavailable");
        setMessage("请在 B站 App 或已登录的 B站网页中打开此 Toy。");
        return;
      }
      const result = await Promise.race([
        window.toy!.getAuthorRelation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 9000),
        ),
      ]);
      if (
        result.status === "ok" &&
        typeof result.data?.isFollowing === "boolean"
      )
        setState(result.data.isFollowing ? "open" : "locked");
      else {
        setState("unavailable");
        setMessage("暂时无法读取关注状态，请先登录 B站后再试。");
      }
    } catch {
      setState("unavailable");
      setMessage("关注状态检查失败，请稍后重试。");
    } finally {
      pending.current = false;
    }
  }, []);
  useEffect(() => {
    void check();
    const refresh = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [check]);
  return { state, message, check };
}
function Gate({ gate }: { gate: ReturnType<typeof useFollowGate> }) {
  return (
    <div className="quiz-lock">
      <LockKeyhole size={22} />
      <div>
        <strong>
          {gate.state === "checking" ? "检查关注状态…" : "关注作者，解锁游戏"}
        </strong>
        <p>{gate.message || "通过 Toy 的作者入口关注后，回来继续。"}</p>
      </div>
      <button
        className="quiz-button quiz-button--small"
        disabled={gate.state === "checking"}
        onClick={() => void gate.check()}
      >
        {gate.state === "checking" ? "检查中" : "我已关注，检查解锁"}
      </button>
    </div>
  );
}
export default function Games({ playing }: { playing: boolean }) {
  useGameViewport();
  const gate = useFollowGate();
  const [preview, setPreview] = useState(false);
  const isPreview = /^\/toy\/preview\/author_[A-Za-z0-9]+\//.test(
    window.location.pathname,
  );
  const previewButton =
    isPreview && gate.state === "unavailable" ? (
      <button className="quiz-text-button" onClick={() => setPreview(true)}>
        预览试玩（固定题库）
      </button>
    ) : null;
  return (
    <section className="toy-games" aria-label="VibeCoding 游戏">
      {!playing ? (
        <>
          <div className="quiz-lobby-heading">
            <span className="quiz-label">游戏专区</span>
            <h1>
              和 AI 同事
              <br />
              闯点小祸。
            </h1>
            <span className="quiz-doodle" aria-hidden="true">
              ✳
            </span>
          </div>
          <a className="quiz-game-cover" href={routeHref("/games/quiz")}>
            <div className="quiz-cover-copy">
              <span className="quiz-label quiz-label--yellow">情境问答</span>
              <h2>
                这也敢
                <br />
                上线？<span>!</span>
              </h2>
              <p>5 个现场 · 约 2 分钟</p>
            </div>
            <Robot pose="oops" />
            <div className="quiz-cover-bottom">
              <span>{gate.state === "open" ? "已解锁" : "关注作者解锁"}</span>
              <span>
                进入游戏 <ArrowRight size={19} />
              </span>
            </div>
          </a>
          {gate.state !== "open" ? (
            <Gate gate={gate} />
          ) : (
            <p className="quiz-unlocked">
              <Check size={16} /> 已关注，可以开玩了
            </p>
          )}
        </>
      ) : gate.state !== "open" && !preview ? (
        <div className="quiz-welcome">
          <Robot pose="ready" />
          <span className="quiz-label">情境问答 · 5 回合</span>
          <h1>这也敢上线？</h1>
          <p>
            AI 负责写，你负责判断。
            <br />
            先把这次上线保下来。
          </p>
          <Gate gate={gate} />
          {previewButton}
        </div>
      ) : (
        <>
          <p className="quiz-preview-note" hidden={!preview}>
            预览试玩 · 固定题库；正式版需关注作者解锁
          </p>
          <Quiz preview={preview} />
        </>
      )}
    </section>
  );
}
function Quiz({ preview = false }: { preview?: boolean }) {
  const [phase, setPhase] = useState<"lobby" | "loading" | "playing" | "done">(
    "lobby",
  );
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [human, setHuman] = useState("");
  const [pack, setPack] = useState<Pack | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [feedback, setFeedback] = useState<Answer | null>(null);
  const [options, setOptions] = useState<{ label: string; index: number }[][]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [best, setBest] = useState(0);
  const token = useRef("");
  const lock = useRef(false);
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [review, setReview] = useState<number | null>(null);
  const [reviewTab, setReviewTab] = useState<"lesson" | "example">("lesson");
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    if (!preview)
      void gameRequest<GameConfig>(
        "config",
        undefined,
        undefined,
        controller.signal,
      )
        .then(setConfig)
        .catch(() => setConfig(null));
    try {
      const b = Number(localStorage.getItem("vibe-quiz-best"));
      if (Number.isFinite(b) && b > 0 && b <= 100) setBest(b);
    } catch {
      /* optional local record */
    }
    return () => {
      mounted.current = false;
      controller.abort();
      abort.current?.abort();
      token.current = "";
    };
  }, [preview]);
  const focus = () =>
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  const accept = (next: Pack) => {
    setPack(next);
    setOptions(
      next.rounds.map((q) =>
        shuffled(q.choices.map((label, i) => ({ label, index: i }))),
      ),
    );
    setIndex(0);
    setAnswers([]);
    setFeedback(null);
    setReview(null);
    setWriting(false);
    setDraft("");
    setPhase("playing");
    focus();
  };
  const start = async (ai: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    if (!ai) {
      token.current = "";
      accept(authoredPack());
      setBusy(false);
      lock.current = false;
      return;
    }
    setPhase("loading");
    abort.current = new AbortController();
    try {
      const session = await gameRequest<{ sessionToken: string }>(
        "session",
        { turnstileToken: human },
        undefined,
        abort.current.signal,
      );
      token.current = session.sessionToken;
      setHuman("");
      const result = await gameRequest<Pack>(
        "quiz",
        {},
        token.current,
        abort.current.signal,
      );
      if (mounted.current) accept(result);
    } catch (e) {
      if (mounted.current) {
        token.current = "";
        setNotice(errorMessage(e));
        setPhase("lobby");
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const round = pack?.rounds[index];
  const submit = async (choice?: number) => {
    if (!round || feedback || lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      let result: Answer;
      if (pack!.source === "authored") {
        const q = scenarioById(round.id)!;
        const correct = choice === q.correct;
        result = {
          questionId: q.id,
          choice,
          correct,
          score: correct ? 100 : 0,
          quip: q.replies[choice!],
          lesson: q.lesson,
          correctChoice: q.correct,
          example: q.example,
        };
      } else
        result = await gameRequest<Answer>(
          choice === undefined ? "judge" : "answer",
          choice === undefined
            ? { questionId: round.id, answer: draft.trim() }
            : { questionId: round.id, choice },
          token.current,
        );
      if (mounted.current) {
        setFeedback(result);
        setAnswers((old) => [...old, result]);
        setWriting(false);
      }
    } catch (e) {
      if (mounted.current) {
        setNotice(errorMessage(e));
        setWriting(false);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const next = () => {
    if (index === 4) {
      const average = Math.round(answers.reduce((n, a) => n + a.score, 0) / 5);
      if (average > best) {
        setBest(average);
        try {
          localStorage.setItem("vibe-quiz-best", String(average));
        } catch {
          /* optional */
        }
      }
      token.current = "";
      setPhase("done");
    } else {
      setIndex((x) => x + 1);
      setFeedback(null);
      setDraft("");
      setWriting(false);
    }
    focus();
  };
  const score = Math.round(answers.reduce((n, a) => n + a.score, 0) / 5);
  const correct = answers.filter((a) => a.correct).length;
  const combo = answers.reduce((n, a) => (a.correct ? n + 1 : 0), 0);
  if (phase === "lobby")
    return (
      <div className="quiz-welcome">
        <Robot pose="ready" />
        <span className="quiz-label">情境问答 · 5 回合</span>
        <h1 ref={heading} tabIndex={-1}>
          这也敢上线？
        </h1>
        <p>
          AI 写了个“能跑”的应用。
          <br />
          你能拦住几次翻车？
        </p>
        <div className="quiz-start-panel">
          {config?.configured && config.turnstileSiteKey ? (
            <>
              <HumanCheck
                siteKey={config.turnstileSiteKey}
                onToken={setHuman}
              />
              <button
                className="quiz-button"
                disabled={!human || busy}
                onClick={() => void start(true)}
              >
                <Sparkles size={19} /> AI 今日挑战 <ArrowRight size={19} />
              </button>
              <button
                className="quiz-text-button"
                disabled={busy}
                onClick={() => void start(false)}
              >
                玩固定题库
              </button>
            </>
          ) : (
            <>
              <button
                className="quiz-button"
                disabled={busy}
                onClick={() => void start(false)}
              >
                开始闯关 <ArrowRight size={19} />
              </button>
              <small className="quiz-source-note">
                固定题库 · AI 挑战准备中
              </small>
            </>
          )}
          {best > 0 ? (
            <p className="quiz-best">
              <Trophy size={15} /> 我的最佳 {best} 分
            </p>
          ) : null}
          {notice ? (
            <p className="quiz-notice" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    );
  if (phase === "loading")
    return (
      <div className="quiz-welcome" role="status">
        <Robot pose="think" />
        <h1>同事正在交作业…</h1>
        <p>先看看这次留下了什么现场。</p>
        <button
          className="quiz-text-button"
          onClick={() => {
            abort.current?.abort();
            token.current = "";
            setPhase("lobby");
          }}
        >
          返回
        </button>
      </div>
    );
  if (phase === "done") {
    if (review !== null) {
      const answer = answers[review];
      return (
        <div className="quiz-review">
          <div className="quiz-review-heading">
            <span className="quiz-label">逐题复盘 · {review + 1} / 5</span>
            <button
              className="quiz-text-button"
              onClick={() => setReview(null)}
            >
              返回战绩
            </button>
          </div>
          <div className="quiz-review-title">
            <Robot pose={answer.correct ? "good" : "oops"} />
            <h1 ref={heading} tabIndex={-1}>
              {pack!.rounds[review].title}
            </h1>
            <b>{answer.score} 分</b>
          </div>
          <div className="quiz-tabs" role="tablist" aria-label="复盘内容">
            <button
              role="tab"
              aria-selected={reviewTab === "lesson"}
              onClick={() => setReviewTab("lesson")}
            >
              这题要点
            </button>
            <button
              role="tab"
              aria-selected={reviewTab === "example"}
              onClick={() => setReviewTab("example")}
            >
              指令示例
            </button>
          </div>
          <div className="quiz-paper quiz-review-copy">
            <PagedCopy
              key={review + "-" + reviewTab}
              paragraphs={[
                reviewTab === "lesson" ? answer.lesson : answer.example,
              ]}
              label="复盘文字"
            />
          </div>
          <div className="quiz-review-actions">
            <button
              className="quiz-button quiz-button--secondary"
              disabled={review === 0}
              onClick={() => setReview((x) => x! - 1)}
            >
              <ChevronLeft size={17} />
              上一题
            </button>
            <button
              className="quiz-button"
              disabled={review === 4}
              onClick={() => setReview((x) => x! + 1)}
            >
              下一题
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="quiz-result">
        <Robot pose={correct >= 3 ? "win" : "sleep"} />
        <span className="quiz-label">本次结算</span>
        <h1 ref={heading} tabIndex={-1}>
          {score >= 80
            ? "上线守门员"
            : score >= 40
              ? "靠谱合伙人"
              : "翻车体验官"}
        </h1>
        <div className="quiz-final-score">
          <strong>{score}</strong>
          <span>/ 100</span>
        </div>
        <p>
          {correct >= 4
            ? "AI 可以发挥了，你负责兜底。"
            : correct >= 2
              ? "已经发现几个坑，下次更稳。"
              : "这次踩过的坑，下次就是经验。"}
        </p>
        <div className="quiz-score-strip" aria-label="选择一题复盘">
          {answers.map((answer, i) => (
            <button
              key={answer.questionId}
              aria-label={`复盘第 ${i + 1} 题`}
              onClick={() => {
                setReview(i);
                setReviewTab("lesson");
              }}
            >
              <span className={answer.correct ? "quiz-check" : "quiz-cross"}>
                {answer.correct ? <Check size={17} /> : <X size={17} />}
              </span>
              <small>第 {i + 1} 题</small>
            </button>
          ))}
        </div>
        <small className="quiz-source-note">
          点一题复盘 · 本机最佳 {best} 分
        </small>
        <div className="quiz-result-actions">
          <button
            className="quiz-button"
            onClick={() => {
              setPhase("lobby");
              setPack(null);
              setNotice("");
              focus();
            }}
          >
            <RotateCcw size={18} />
            再来一局
          </button>
          <a className="quiz-text-button" href={routeHref("/games")}>
            回到游戏专区
          </a>
        </div>
      </div>
    );
  }
  if (!round) return null;
  return (
    <div className="quiz-play">
      <div className="quiz-progress-line">
        <span className="quiz-label">
          {pack?.source === "authored" ? "固定题库" : "AI 今日挑战"}
        </span>
        <span>
          现场 <b>{index + 1}</b> / 5
        </span>
        {combo >= 2 ? (
          <span className="quiz-combo">
            <Flame size={15} />
            {combo} 连对
          </span>
        ) : null}
      </div>
      <div
        className="quiz-progress"
        role="progressbar"
        aria-label="闯关进度"
        aria-valuenow={index + (feedback ? 1 : 0)}
        aria-valuemin={0}
        aria-valuemax={5}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <i
            key={i}
            data-complete={i < index || (i === index && !!feedback)}
            data-current={i === index}
          />
        ))}
      </div>
      {feedback ? (
        <Feedback
          key={round.id}
          answer={feedback}
          title={round.title}
          last={index === 4}
          onNext={next}
        />
      ) : writing ? (
        <form
          className="quiz-writing"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="quiz-instruction">{round.challenge}</label>
          <textarea
            id="quiz-instruction"
            autoFocus
            rows={3}
            maxLength={280}
            value={draft}
            disabled={busy}
            placeholder="告诉 AI 具体做什么，以及怎样才算完成。"
            onChange={(e) => setDraft(e.target.value)}
          />
          <small className="quiz-source-note">
            内容会发送至 OpenRouter 及其模型供应商，请勿填写敏感信息。
            {draft.trim().length} / 280
          </small>
          <button
            className="quiz-button"
            disabled={busy || draft.trim().length < 3}
          >
            <Send size={16} />
            {busy ? "点评中…" : "交给 AI 点评"}
          </button>
          <button
            type="button"
            className="quiz-text-button"
            disabled={busy}
            onClick={() => setWriting(false)}
          >
            回到选择题
          </button>
        </form>
      ) : (
        <>
          <div className="quiz-scene quiz-paper" key={round.id}>
            <div className="quiz-scene-heading">
              <h1 ref={heading} tabIndex={-1}>
                {round.title}
              </h1>
              <Robot pose={busy ? "think" : "ready"} />
            </div>
            <PagedCopy
              paragraphs={[round.scene, "线索：" + round.clue]}
              label="题目文字"
            />
          </div>
          <div className="quiz-choices" aria-label="选择你的处理方式">
            {options[index].map((option, i) => (
              <button
                key={option.index}
                className="quiz-choice"
                disabled={busy}
                onClick={() => void submit(option.index)}
              >
                <span className="quiz-option-letter">{"ABC"[i]}</span>
                <span>{option.label}</span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {index === 4 && pack?.source === "openrouter" ? (
            <button
              className="quiz-text-button quiz-write-link"
              disabled={busy}
              onClick={() => setWriting(true)}
            >
              <Sparkles size={16} />
              最后一关，自己写一句指令
            </button>
          ) : null}
        </>
      )}
      {busy && !writing ? (
        <p className="quiz-working" role="status">
          正在记录你的选择…
        </p>
      ) : null}
      {notice ? (
        <div className="quiz-notice" role="alert">
          <p>{notice}</p>
          <button
            className="quiz-text-button"
            onClick={() => {
              token.current = "";
              accept(authoredPack());
              setNotice("");
            }}
          >
            新开一局固定题库
          </button>
        </div>
      ) : null}
    </div>
  );
}
function Feedback({
  answer,
  title,
  last,
  onNext,
}: {
  answer: Answer;
  title: string;
  last: boolean;
  onNext: () => void;
}) {
  const [tab, setTab] = useState<
    "lesson" | "example" | "checks" | "suggestion"
  >("lesson");
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  const tabs = [
    { id: "lesson", text: "点评" },
    { id: "example", text: "指令" },
    ...(answer.checks
      ? [
          { id: "checks", text: "评分" },
          { id: "suggestion", text: "建议" },
        ]
      : []),
  ] as const;
  const paragraphs =
    tab === "lesson"
      ? [answer.quip, answer.lesson]
      : tab === "example"
        ? [answer.example]
        : tab === "checks"
          ? answer.checks!.map(
              (c) =>
                (c.met ? "✓ " : "✕ ") +
                c.criterion +
                (c.evidence ? "\n“" + c.evidence + "”" : ""),
            )
          : [answer.suggestion || ""];
  return (
    <div className="quiz-feedback" data-correct={answer.correct}>
      <div className="quiz-feedback-head">
        <Robot pose={answer.correct ? "good" : "oops"} />
        <div>
          <small>{title}</small>
          <h1 ref={titleRef} tabIndex={-1}>
            {answer.correct ? "稳住了！" : "哎，翻车了。"}
          </h1>
        </div>
        <span>+{answer.score}</span>
      </div>
      <div className="quiz-tabs" role="tablist" aria-label="答题反馈">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id as typeof tab)}
          >
            {t.text}
          </button>
        ))}
      </div>
      <div className="quiz-paper quiz-feedback-copy">
        <PagedCopy key={tab} paragraphs={paragraphs} label="反馈文字" />
      </div>
      <button className="quiz-button" onClick={onNext}>
        {last ? "看看战绩" : "下一个现场"}
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
