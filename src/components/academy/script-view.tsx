import { parseScript, type InlineNode, type ScriptBlock } from "@/lib/academy/markdown";
import { cn } from "@/lib/utils";

/**
 * Le rendu d'un script de leçon.
 *
 * Composant sans directive : le serveur rend la page de lecture, le
 * back-office le monte côté client pour l'aperçu en direct — même parseur,
 * même rendu, aucun écart possible entre les deux.
 *
 * La largeur est bornée à 72ch : un script se lit comme un texte, pas comme
 * une page de dashboard, et une ligne de 200 caractères se relit deux fois.
 */

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "strong":
            return (
              <strong key={index} className="font-semibold">
                {node.value}
              </strong>
            );
          case "em":
            return <em key={index}>{node.value}</em>;
          case "code":
            return (
              <code
                key={index}
                className="rounded-sm bg-surface-sunken px-1 py-0.5 font-mono text-[0.9em]"
              >
                {node.value}
              </code>
            );
          case "link":
            return (
              <a
                key={index}
                href={node.href}
                target="_blank"
                rel="noreferrer"
                className="text-accent-ink underline underline-offset-2"
              >
                {node.value}
              </a>
            );
          default:
            return <span key={index}>{node.value}</span>;
        }
      })}
    </>
  );
}

function Block({ block }: { block: ScriptBlock }) {
  switch (block.kind) {
    case "heading":
      return block.level === 2 ? (
        <h2 className="type-h3 mt-8 first:mt-0">
          <Inline nodes={block.content} />
        </h2>
      ) : (
        <h3 className="type-label mt-6 text-text-primary">
          <Inline nodes={block.content} />
        </h3>
      );
    case "paragraph":
      return (
        <p className="type-body mt-3 leading-relaxed text-text-primary">
          <Inline nodes={block.content} />
        </p>
      );
    case "list":
      return block.ordered ? (
        <ol className="type-body mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed text-text-primary">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline nodes={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="type-body mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-text-primary">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline nodes={item} />
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="type-body mt-3 border-l-2 border-border-strong pl-4 leading-relaxed text-text-secondary italic">
          <Inline nodes={block.content} />
        </blockquote>
      );
    case "hr":
      return <hr className="mt-6 border-border" />;
  }
}

export function ScriptView({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const blocks = parseScript(markdown);

  if (blocks.length === 0) {
    return (
      <p className={cn("type-body text-text-secondary", className)}>
        Le script de cette leçon n&apos;est pas encore rédigé.
      </p>
    );
  }

  return (
    <div className={cn("max-w-[72ch]", className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
