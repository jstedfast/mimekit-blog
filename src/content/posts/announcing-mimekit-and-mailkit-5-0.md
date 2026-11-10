---
title: "Announcing MimeKit and MailKit 5.0"
description: "A leaner package structure, a new default MIME parser, DMARC validation, redesigned TNEF support, and new APIs for sending and synchronizing mail."
pubDate: 2026-11-10
tags: ["MimeKit", "MailKit", "Releases"]
draft: false
---

**MimeKit and MailKit 5.0 are now available on NuGet!**

These releases bring changes to both sides of working with email: the messages
themselves, and the protocols used to send and receive them.

The biggest change shared by both projects is a new package structure that
separates MIME handling from cryptography but there is much more in this
release: a new default MIME parser, optional compliance diagnostics, DMARC
validation, a redesigned TNEF implementation, and new MailKit APIs for sending
messages and watching mailboxes.

These are **major releases with breaking changes**. This post covers the
highlights; the porting guides linked below cover the changes to look for in
an existing application.

## A smaller dependency footprint

In 4.x, using MailKit also meant bringing in MimeKit's cryptography dependencies,
even if all an application needed was to send a message or read an IMAP folder.
Version 5.0 separates those concerns:

| Package | What it provides |
| --- | --- |
| `MimeKit.Core` | MIME parsing, message construction, and the core message APIs. |
| `MimeKit.Cryptography` | S/MIME, OpenPGP, DKIM, ARC, and DMARC support. |
| `MimeKit` | A convenience meta-package referencing both packages above. |
| `MailKit` | SMTP, IMAP, and POP3 clients, depending on `MimeKit.Core`. |

**MailKit itself no longer depends on BouncyCastle.** Its last use of
BouncyCastle, compression for IMAP's `COMPRESS=DEFLATE` extension, has been
replaced with `System.IO.Compression.DeflateStream`.

This also removes the need for separate "Lite" packages. `MimeKitLite` is
replaced by `MimeKit.Core`, and `MailKitLite` is replaced by `MailKit`.
The familiar `MimeKit` namespace is unchanged, although its core types now
live in the `MimeKit.Core` assembly.

There is one important platform tradeoff: **IMAP compression is now supported
only on .NET 8.0 and later**. The .NET Framework and .NET Standard implementations
of `DeflateStream.Flush ()` do not provide the flushing behavior needed by an
interactive protocol. This restriction applies to compression, not to IMAP
support as a whole.

## A new default MIME parser

The parser previously named `ExperimentalMimeParser` is now `MimeParser` in
5.0. The old implementation remains available as `LegacyMimeParser`.

The new parser uses `MimeReader` internally, and nested messages and multiparts
are parsed without recursion. Writing and disposing deeply nested message
trees have also been changed to use iterative traversal. These changes avoid
call-stack exhaustion when processing deeply nested MIME structures.

Content storage is more explicit, too. The old `persistent` boolean is replaced
by `MimeContentStorage`:

- `Memory`, the default, copies part content into memory.
- `Source` keeps content backed by the caller's input stream. That stream must
  be seekable and must remain open and unchanged while the content is in use.

Unlike the old behavior, requesting source-backed storage on a nonseekable
stream throws rather than silently copying the content.

### See what is wrong without rejecting the message

Real-world email is not always well formed. MimeKit's tolerant parsing remains,
but applications can now ask it to explain the problems it encounters.

Set `ComplianceLogger` on `MimeParser` or `MimeReader` to receive structured
diagnostics for malformed headers, addresses, MIME parameters, transfer
encodings, and message structure. Reports include position information and
classify issues by severity and by interoperability, data-loss, or security
concerns.

Reporting is optional and does not make the parser reject messages it would
otherwise accept. It is useful for diagnosing a broken sender, inspecting
archived mail, or understanding why a message behaves differently across
email clients.

For a working example, see the
[MimeAnalyzer sample](https://github.com/jstedfast/MimeKit/tree/master/samples/MimeAnalyzer)
in the MimeKit repository. It reports compliance violations in a compiler-style
`file:line:column: severity: message` format and provides a starting point for
adding diagnostics to your own tools.

## SIMD optimizations and parsing performance

Version 5.0 also makes greater use of SIMD (single instruction, multiple data)
to process blocks of bytes at a time rather than examining each byte
individually. On .NET 8 and later, the new parser uses SIMD for content scanning
and UTF-8 header validation, with fallback paths for unsupported hardware.
Compliance reporting benefits from vectorized scanning too, while retaining
the position information needed to identify malformed input.

The optimizations extend beyond the parser. Base64 decoding uses MimeKit's own
SSSE3, AVX2, and Arm64 AdvSIMD implementations, preserving permissive decoding
while enabling hardware acceleration by default on .NET 8 and later.
The uuencode encoder and decoder also gain SIMD implementations for those
instruction sets. Base64 encoding has been optimized as well.

### Selected parser benchmarks

These **BenchmarkDotNet** measurements from November 6, 2026 compare the
published MimeKit 4.18.1 package with **5.0 prerelease**, with compliance
reporting off and on. Throughput is in **MiB/s; higher is better**.

| Workload | 4.18.1 | 5.0, compliance off | 5.0, compliance on |
|:---------|-------:|-------------------:|------------------:|
| Enron messages | 476 | 613 | 427 |
| UTF-8 headers | 471 | 1,131 | 859 |
| Attachments, CRLF | 8,789 | 17,062 | 10,423 |
| 32-character lines | 4,427 | 12,034 | 9,442 |
| 998-character lines | 19,779 | 19,838 | 13,309 |
| QP, dense UTF-8 escapes | 7,051 | 13,353 | 1,707 |

With reporting off, Enron throughput improves by about **29%**, UTF-8 headers
by **2.4x**, and 32-character lines by **2.7x**. The 998-character-line result
is effectively unchanged within measurement variability.

The table also makes the cost of diagnostics visible. Compliance reporting
performs additional validation, and its overhead depends heavily on the
message content. Dense quoted-printable (QP) escapes are a particularly
expensive case here. Applications that need those diagnostics can opt in;
applications that only need to parse messages can leave reporting disabled.
Actual throughput will depend on the hardware, runtime, and messages being
processed.

### Encoder and decoder benchmarks

These are standalone codec measurements, separate from parsing. Throughput
counts **input bytes**: raw bytes for encoding and encoded bytes for decoding.
The multiplier is 5.0 throughput divided by 4.18.1 throughput.

| Codec | Operation | 4.18.1 MiB/s | 5.0 MiB/s | Throughput ratio |
|:--------------|:----------|------------:|----------:|-----------------:|
| Base64 | Encode | 6,395 | 11,509 | 1.80x |
| Base64 | Decode | 707 | 18,737 | 26.49x |
| UU | Encode | 1,401 | 22,490 | 16.06x |
| UU | Decode | 675 | 10,866 | 16.09x |

These comparisons use each version's shipped acceleration defaults. In
particular, **Base64 decoder acceleration is off by default in 4.18.1 and on
in 5.0** on this machine; that result is not an accelerated-versus-accelerated
comparison. Gains depend on the input.

### Benchmark setup

**Environment and versions.** Intel Core Ultra 7 268V (8 physical cores,
8 logical processors), Windows 11 Enterprise Insider Preview x64,
build 26310.28158, **.NET 10.0.14**, X64 RyuJIT with AVX2, and concurrent
workstation GC. Built in `Release` for `net10.0` with SDK 10.0.403, comparing
the published 4.18.1 NuGet binary with **5.0 prerelease at commit `f3ad01c2`**;
both libraries target .NET 10. The High performance power plan was used,
and each benchmark child process was verified as pinned to performance core
logical processor 2 (affinity mask `0x4`).

**Parser configuration.** Synchronous parsing from preloaded bytes, with a
fresh stream and parser per message, including MIME tree construction and
disposal. Source-backed storage was selected: `persistent: true` in 4.18.1
and `MimeContentStorage.Source` in 5.0. Input loading, disk I/O, serialization
and attachment decoding were excluded. These are **not** measurements of the
default `Memory` storage mode. The six workloads combine Enron messages,
attachment fixtures and synthetic inputs: 3,005 accepted fixture entries in
total, excluding two Enron messages that exceed 5.0's default 16 KiB header
limit. Parser output was checked before timing.

**Compliance configuration.** Off means `ComplianceLogger = null`. On means
`MimeComplianceValidators.All`, `MaxIssuesPerViolation = 1`, and a counting-only
logger. Validation and logger callbacks are included; formatting, retaining
and writing diagnostics are not.

**Codec configuration.** Each payload is 64 KiB, processed in 4 KiB input
chunks using reused codecs and preallocated output buffers. Base64 and UU
use deterministic pseudorandom binary data (`Random(12345)`).
Both versions emit LF line endings, selected explicitly
with `NewLineFormat.Unix` in 5.0. Both decoders consume the same input produced
by 4.18.1; UU measures the payload without a `begin`/`end` envelope. Reset and
final flushing, where supported, are timed; construction, allocation and
correctness checks are not. Outputs and round trips were verified.

**Timing and uncertainty.** BenchmarkDotNet **0.15.8**, with `MemoryDiagnoser`,
26 cases shown and **two isolated process launches per case**. Each target gets a
ten-second untimed warmup before BenchmarkDotNet's default calibration,
adaptive warmup and measurement, with default upper-outlier removal. This
avoids calibrating against early JIT tiers; runtime tiering settings were left
at their defaults. Values are input bytes divided by BenchmarkDotNet's mean
time, rounded to the nearest MiB/s; ratios use unrounded values. The largest
99.9% timing-confidence half-width was 4.1% of the mean. Raw mean timings
between the two launches differed by up to 10.7%, so small differences should
not be treated as meaningful wins. These are workload-specific measurements,
not performance guarantees.

## DMARC and more useful authentication results

MimeKit 5.0 adds `DmarcVerifier`, bringing DMARC policy discovery and identifier
alignment checks alongside the existing DKIM and ARC support.

The verifier uses a caller-provided `IDnsResolver` for DNS TXT lookups. It can
verify DKIM signatures itself or work with results the application already has.
**MimeKit does not perform SPF checks**: applications supply the result of
their own SPF evaluation.

DKIM verification also moves beyond a simple `bool`. A
`DkimSignatureValidationResult` distinguishes success, failure, policy
rejection, temporary errors, and permanent errors, with additional diagnostic
information. ARC verification gains more detailed failure diagnostics as well.

That distinction matters when, for example, a DNS lookup temporarily fails.
Applications can make a more informed decision than treating every unsuccessful
verification as the same kind of failure.

## TNEF gets a new object model

If you have ever had to deal with a `winmail.dat` attachment, you have encountered
TNEF. Version 5.0 substantially redesigns this part of MimeKit.

The new `TnefMessage` model exposes attachments, recipients, message bodies,
and properties. The readers have asynchronous APIs and improved handling of
corrupt or truncated input, and new `TnefWriter` and `TnefPropertyWriter` APIs
support producing TNEF streams.

Conversion to MIME now goes through `TnefMessage.ConvertToMime ()`. Along with
the converted message, the result reports information that could not be
represented, rather than leaving applications unaware of conversion losses.

The conversion also handles calendar content, generating `text/calendar` parts
for appointments and meeting messages, including recurrence information.
Body selection follows Microsoft's best-body rules rather than adding every
available body representation as an alternative.

Applications using the old low-level TNEF APIs or `TnefPart.ConvertToMessage ()`
should review the TNEF section of the MimeKit porting guide.

## MailKit: more control over each operation

MailKit 5.0 introduces request objects for sending messages. `SendRequest` and
`SmtpSendRequest` collect the message, envelope, progress reporting, and
SMTP-specific options in one place.

This moves customization from the lifetime of an `SmtpClient` to an individual
send operation. For example, delivery-status notification settings and
recipient-acceptance callbacks can now belong to a particular request instead
of requiring a custom client subclass.

Sending also returns a `SendResult` rather than a response string. The result
provides the final response text and accepted and rejected recipient lists.
The familiar `Send (message)` and `SendAsync (message)` calls remain available
as extension methods in the `MailKit` namespace.

SMTP failures carry more context, including the command being processed and
the server's response. More generally, new protocol and command error
classifications help applications distinguish conditions such as an invalid
response, a permission failure, or a temporary server error without parsing
exception messages.

### Watching and synchronizing mailboxes

`ImapIdleSession` provides a higher-level way to wait for changes to the selected
folder. It manages refreshing the `IDLE` command, groups bursts of events into
batches, and falls back to polling with `NOOP` when a server does not support
`IDLE`. Changes can also be consumed as an asynchronous sequence.

IMAP request callbacks make it easier to track which parts of an operation
actually completed. This is particularly useful when a large operation is
split into several commands: an application can observe successful subsets
rather than assuming that everything either happened or did not happen.
These APIs provide building blocks for synchronization; they are not a complete
offline synchronization engine.

Other changes include 64-bit message sizes and byte offsets, capability
collections that expose extensions MailKit does not yet recognize, and a
combined `Enable (ImapFeatures)` API.

Mail clients also support `IAsyncDisposable` and `await using`. Disposal is
still not a protocol logout: call `DisconnectAsync (true)` first when you want
to disconnect cleanly.

## Upgrading from 4.x

Start with the package references, but do not stop at getting the code to
compile. Some changes affect runtime behavior.

**Applications using cryptography need explicit setup.** If you previously
received cryptography support through MailKit's dependencies, add
`MimeKit.Cryptography` or the `MimeKit` meta-package. Initialize the cryptography
module during startup, before parsing messages that need cryptographic entity
types:

```csharp
using MimeKit.Cryptography;

CryptographyModule.Initialize ();
```

S/MIME applications must also explicitly register their chosen
`CryptographyContext`, or pass a context to APIs that accept one. MimeKit no
longer registers a default S/MIME implementation automatically, removing that
implicit dependency for AOT applications.

Several cryptographic defaults are stricter: OpenPGP decryption checks integrity
and rejects unprotected legacy packets by default, importing a self-signed
certificate into `TemporarySecureMimeContext` no longer automatically makes it
trusted, and signing overloads without an explicit digest now use SHA-256
instead of SHA-1.

For MailKit applications, pay particular attention to send return values,
capability checks, 64-bit sizes, and any custom client or folder implementations.
Mocks and test doubles that implement the interfaces may need changes too.

Both projects include detailed migration documentation:

- [Porting from MimeKit 4.x to 5.0](https://github.com/jstedfast/MimeKit/blob/master/PortingGuide.md)
- [Porting from MailKit 4.x to 5.0](https://github.com/jstedfast/MailKit/blob/master/PortingGuide.md)

MailKit users should read both guides, since upgrading MailKit also upgrades
the underlying MIME library.

## Getting started

Version 5.0.0 is available for both [MimeKit](https://www.nuget.org/packages/MimeKit/5.0.0)
and [MailKit](https://www.nuget.org/packages/MailKit/5.0.0).

For an application that sends or receives mail:

```bash
dotnet add package MailKit --version 5.0.0
```

For MIME message handling without the mail protocol clients or cryptography:

```bash
dotnet add package MimeKit.Core --version 5.0.0
```

If you also need cryptography, add:

```bash
dotnet add package MimeKit.Cryptography --version 5.0.0
```

The `MimeKit` meta-package remains an option when you want both the core and
cryptography packages together.

For the complete details, including additional APIs, behavioral changes, and
bug fixes, see the [MimeKit release notes](https://github.com/jstedfast/MimeKit/blob/master/ReleaseNotes.md)
and [MailKit release notes](https://github.com/jstedfast/MailKit/blob/master/ReleaseNotes.md).

Thanks to everyone who has contributed bug reports, real-world test messages,
patches, and support for these projects.
