import { expect, test } from "vitest";
import { emitToString } from "./emit";

test("emitting with no schemas returns error", async () => {
    //act
    const emitResult = await emitToString("4.13.8", "https://ftrack.example.com", []);

    //assert
    expect(emitResult?.errors[0]).toBe('No schemas found!');
});
