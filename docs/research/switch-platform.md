# Platform: Nintendo Switch

## What is known

- FireRed/LeafGreen run on the Switch on a Nintendo GBA emulator, with the original ROM.
- Trading, which on the GBA used a link cable or the wireless adapter, goes over LDN (the Switch's local wireless mode, over Wi-Fi) with Pia on top. The GBA link is emulated as RFU (wireless adapter). Source: `references/pokeldn/docs/frlg_host.md`.
- The pokeldn project (in `references/`) already implements the trade partner on a PC, with an ESP32 as the radio.
- Emerald availability on the Switch: to be confirmed.

## What this implies

- No direct access to the ROM, RAM, save or scripts. Every injection vector has to go through:
  - controller input;
  - the trade channel;
  - game state manipulated by glitches.
- PC emulator tools (mGBA, Lua) are useful for researching and testing offline, but they are not the final target.
- The emulator's behavior may differ from the hardware in places ACE relies on: open bus, timing, uninitialized RAM state. Each technique needs to be validated on the Switch.

## Risks

- Using the online trade channel with manipulated data can affect other players and violate Nintendo's terms. Trade tests must be done between your own consoles or devices.

## Open questions

- Details of the trade protocol on the Switch (see the pokeldn docs).
- Whether the emulator exposes its own features (rewind, save state) that help or hinder glitches.
