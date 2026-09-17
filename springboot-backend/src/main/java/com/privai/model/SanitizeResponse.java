package com.privai.model;

import java.util.List;
import java.util.Map;

public class SanitizeResponse {
    private String sanitizedText;
    private List<DetectedEntity> entities;
    private Map<String, String> tokenMap;
    private long durationMs;

    public SanitizeResponse() {}

    public SanitizeResponse(String sanitizedText, List<DetectedEntity> entities, Map<String, String> tokenMap, long durationMs) {
        this.sanitizedText = sanitizedText;
        this.entities = entities;
        this.tokenMap = tokenMap;
        this.durationMs = durationMs;
    }

    public String getSanitizedText() {
        return sanitizedText;
    }

    public void setSanitizedText(String sanitizedText) {
        this.sanitizedText = sanitizedText;
    }

    public List<DetectedEntity> getEntities() {
        return entities;
    }

    public void setEntities(List<DetectedEntity> entities) {
        this.entities = entities;
    }

    public Map<String, String> getTokenMap() {
        return tokenMap;
    }

    public void setTokenMap(Map<String, String> tokenMap) {
        this.tokenMap = tokenMap;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(long durationMs) {
        this.durationMs = durationMs;
    }
}
