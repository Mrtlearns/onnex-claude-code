# Strategies

## S1: Two-Stage LLM Pipeline
Do not send raw RT documents to a generic LLM. Stage 1 classifies the part type and extracts geometry primitives. Stage 2 assembles a code-specific system prompt dynamically and runs the actual RT analysis. This produces dramatically better accuracy than single-stage prompting.

## S2: Ollama Fallback for Cost and Privacy
All LLM calls route to Anthropic SDK first. Dual RTX 3090 + Ollama provides a local fallback for non-ITAR routine classification — reduces per-job API cost and allows air-gapped deployment for sensitive clients.

## S3: ITAR Compliance as Moat
Most AI document tools do not handle ITAR. Building a correct ITAR-aware pipeline is a technical moat — NDT/aerospace clients need it and competitors don't have it.