import { describe, expect, it, vi } from "vitest";

import { executeAvecReessais } from "../../scripts/sources/reessais.ts";

const sansAttente = { tentatives: 3, delaiEntreTentativesEnMs: 0 };

describe("L'exécution avec réessais", () => {
  it("renvoie le résultat dès la première réussite sans réessayer", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    expect(await executeAvecReessais(operation, sansAttente)).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("réessaie après un échec transitoire", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("réseau coupé"))
      .mockRejectedValueOnce(new Error("réseau coupé"))
      .mockResolvedValue("ok");
    expect(await executeAvecReessais(operation, sansAttente)).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("signale chaque échec avant de réessayer", async () => {
    const auraEchec = vi.fn();
    const operation = vi.fn().mockRejectedValueOnce(new Error("coupé")).mockResolvedValue("ok");
    await executeAvecReessais(operation, { ...sansAttente, auraEchec });
    expect(auraEchec).toHaveBeenCalledTimes(1);
    expect(auraEchec).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it("renvoie la dernière erreur une fois les tentatives épuisées", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("toujours coupé"));
    await expect(executeAvecReessais(operation, sansAttente)).rejects.toThrow("toujours coupé");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
