import { describe, expect, it } from "vitest";

import { conversationsToThreads, conversationToThread } from "./messages";
import type { MetaConversationRow, MetaMessageRow } from "./messages";

const PAGE = "page-1";
const IG = "ig-brand";
const BRAND = [PAGE, IG];

const message = (over: Partial<MetaMessageRow> = {}): MetaMessageRow => ({
  id: "m1",
  message: "Bonjour, vous livrez en Belgique ?",
  created_time: "2026-08-16T10:00:00+0000",
  from: { id: "u-claire", name: "Claire Dubois" },
  ...over,
});

const conversation = (over: Partial<MetaConversationRow> = {}): MetaConversationRow => ({
  id: "t_conv1",
  updated_time: "2026-08-16T10:00:00+0000",
  participants: {
    data: [
      { id: "u-claire", name: "Claire Dubois" },
      { id: PAGE, name: "Bondet" },
    ],
  },
  messages: { data: [message()] },
  ...over,
});

describe("conversationToThread", () => {
  it("fait d'une conversation Messenger un fil de message privé", () => {
    const thread = conversationToThread({
      conversation: conversation(),
      channel: "facebook",
      brandIds: BRAND,
    })!;

    expect(thread.kind).toBe("dm");
    expect(thread.channel).toBe("facebook");
    expect(thread.externalThreadId).toBe("t_conv1");
    expect(thread.participantHandle).toBe("Claire Dubois");
    expect(thread.participantExternalId).toBe("u-claire");
    // Un message privé ne commente aucune publication.
    expect(thread.post).toBeNull();
  });

  it("remet les messages dans l'ordre : Graph les rend du plus récent au plus ancien", () => {
    const thread = conversationToThread({
      conversation: conversation({
        messages: {
          data: [
            message({
              id: "m2",
              message: "Alors ?",
              created_time: "2026-08-17T09:00:00+0000",
            }),
            message(),
          ],
        },
      }),
      channel: "facebook",
      brandIds: BRAND,
    })!;

    expect(thread.messages.map((entry) => entry.externalId)).toEqual(["m1", "m2"]);
  });

  it("reconnaît nos propres réponses, par la Page comme par le compte Instagram", () => {
    const thread = conversationToThread({
      conversation: conversation({
        messages: {
          data: [
            message(),
            message({
              id: "m2",
              message: "Oui, sous 3 jours !",
              created_time: "2026-08-16T11:00:00+0000",
              from: { id: IG, username: "bondet" },
            }),
          ],
        },
      }),
      channel: "instagram",
      brandIds: BRAND,
    })!;

    expect(thread.messages[1]!.fromBrand).toBe(true);
    expect(thread.messages[0]!.fromBrand).toBe(false);
    // L'interlocuteur reste le client, jamais nous.
    expect(thread.participantExternalId).toBe("u-claire");
  });

  it("garde les pièces jointes d'un message sans texte", () => {
    const thread = conversationToThread({
      conversation: conversation({
        messages: {
          data: [
            message({
              message: undefined,
              attachments: {
                data: [
                  {
                    mime_type: "image/jpeg",
                    name: "photo.jpg",
                    image_data: {
                      url: "https://cdn.example.com/full.jpg",
                      preview_url: "https://cdn.example.com/preview.jpg",
                    },
                  },
                ],
              },
            }),
          ],
        },
      }),
      channel: "instagram",
      brandIds: BRAND,
    })!;

    const attachment = thread.messages[0]!.attachments[0]!;
    expect(attachment.type).toBe("photo");
    expect(attachment.url).toBe("https://cdn.example.com/preview.jpg");
    expect(attachment.href).toBe("https://cdn.example.com/full.jpg");
  });

  it("écarte une conversation où seule la marque a parlé", () => {
    const thread = conversationToThread({
      conversation: conversation({
        participants: { data: [{ id: PAGE, name: "Bondet" }] },
        messages: {
          data: [message({ from: { id: PAGE, name: "Bondet" } })],
        },
      }),
      channel: "facebook",
      brandIds: BRAND,
    });

    expect(thread).toBeNull();
  });

  it("écarte une conversation sans message plutôt que d'en poser une vide", () => {
    expect(
      conversationToThread({
        conversation: conversation({ messages: { data: [] } }),
        channel: "facebook",
        brandIds: BRAND,
      }),
    ).toBeNull();
  });

  it("retombe sur l'auteur du message quand Meta ne liste pas les participants", () => {
    const thread = conversationToThread({
      conversation: conversation({ participants: undefined }),
      channel: "instagram",
      brandIds: BRAND,
    })!;

    expect(thread.participantExternalId).toBe("u-claire");
    expect(thread.participantHandle).toBe("Claire Dubois");
  });
});

describe("conversationsToThreads", () => {
  it("ne garde que les conversations exploitables", () => {
    const threads = conversationsToThreads({
      conversations: [
        conversation(),
        conversation({ id: "t_vide", messages: { data: [] } }),
      ],
      channel: "instagram",
      brandIds: BRAND,
    });

    expect(threads).toHaveLength(1);
    expect(threads[0]!.externalThreadId).toBe("t_conv1");
  });
});
