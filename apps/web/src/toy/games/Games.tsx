import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
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
  const feedbackRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (!feedback) return;
    const frame = requestAnimationFrame(() => {
      feedbackRef.current?.focus({ preventScroll: true });
      feedbackRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [feedback]);
  const focus = () =>
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
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
  if (phase === "done")
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
        <div className="quiz-results-list">
          {answers.map((a, i) => (
            <details key={a.questionId}>
              <summary>
                <span className={a.correct ? "quiz-check" : "quiz-cross"}>
                  {a.correct ? <Check size={16} /> : <X size={16} />}
                </span>
                <strong>{pack!.rounds[i].title}</strong>
                <span>{a.score} 分</span>
                <ChevronRight size={16} />
              </summary>
              <p>{a.lesson}</p>
              <p className="quiz-example">{a.example}</p>
            </details>
          ))}
        </div>
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
            <RotateCcw size={18} /> 再来一局
          </button>
          <a className="quiz-text-button" href={routeHref("/games")}>
            回到游戏专区
          </a>
        </div>
        <small className="quiz-source-note">
          {pack?.source === "authored" ? "固定题库" : "AI 今日题目"} · 本机最佳{" "}
          {best} 分
        </small>
      </div>
    );
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
      <div className="quiz-scene" key={round.id}>
        <div className="quiz-scene-heading">
          <h1 ref={heading} tabIndex={-1}>
            {round.title}
          </h1>
          <Robot
            pose={
              busy
                ? "think"
                : feedback
                  ? feedback.correct
                    ? "good"
                    : "oops"
                  : "ready"
            }
          />
        </div>
        <p>{round.scene}</p>
        <div className="quiz-clue">
          现场线索 <span>{round.clue}</span>
        </div>
      </div>
      {!writing ? (
        <div className="quiz-choices" aria-label="选择你的处理方式">
          {options[index].map((option, i) => (
            <button
              key={option.index}
              className="quiz-choice"
              disabled={busy || !!feedback}
              data-state={
                feedback
                  ? option.index === feedback.correctChoice
                    ? "correct"
                    : option.index === feedback.choice
                      ? "wrong"
                      : undefined
                  : undefined
              }
              onClick={() => void submit(option.index)}
            >
              <span className="quiz-option-letter">{"ABC"[i]}</span>
              <span>{option.label}</span>
              {feedback && option.index === feedback.correctChoice ? (
                <Check size={19} />
              ) : (
                <ChevronRight size={17} />
              )}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="quiz-writing"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="quiz-instruction">{round.challenge}</label>
          <small className="quiz-source-note">
            提交内容将发给 OpenRouter 及其模型供应商，请勿填写密钥等敏感信息。
          </small>
          <textarea
            id="quiz-instruction"
            autoFocus
            rows={4}
            maxLength={280}
            value={draft}
            disabled={busy}
            placeholder="告诉 AI 具体做什么，以及怎样才算完成。"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div>
            <small>{draft.trim().length} / 280</small>
            <button
              className="quiz-button quiz-button--small"
              disabled={busy || draft.trim().length < 3}
            >
              <Send size={16} />
              {busy ? "点评中…" : "交给 AI 点评"}
            </button>
          </div>
          <button
            type="button"
            className="quiz-text-button"
            disabled={busy}
            onClick={() => setWriting(false)}
          >
            回到选择题
          </button>
        </form>
      )}
      {index === 4 && pack?.source === "openrouter" && !feedback && !writing ? (
        <button
          className="quiz-text-button quiz-write-link"
          disabled={busy}
          onClick={() => setWriting(true)}
        >
          <Sparkles size={16} /> 最后一关，自己写一句指令
        </button>
      ) : null}
      {busy ? (
        <p className="quiz-working" role="status">
          {writing ? "正在按标准点评…" : "正在记录你的选择…"}
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
      {feedback ? (
        <div
          className="quiz-feedback"
          ref={feedbackRef}
          tabIndex={-1}
          data-correct={feedback.correct}
          aria-live="polite"
        >
          <div className="quiz-feedback-head">
            <Robot pose={feedback.correct ? "good" : "oops"} />
            <strong>{feedback.correct ? "稳住了！" : "哎，翻车了。"}</strong>
            <span>+{feedback.score}</span>
          </div>
          <p className="quiz-quip">{feedback.quip}</p>
          <p>{feedback.lesson}</p>
          {feedback.checks ? (
            <ul className="quiz-rubric">
              {feedback.checks.map((c) => (
                <li key={c.criterion}>
                  {c.met ? <Check size={15} /> : <X size={15} />}
                  <span>{c.criterion}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {feedback.suggestion ? <p>{feedback.suggestion}</p> : null}
          <details>
            <summary>看看指令怎么写</summary>
            <p>{feedback.example}</p>
          </details>
          <button className="quiz-button" onClick={next}>
            {index === 4 ? "看看战绩" : "下一个现场"}
            <ArrowRight size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
