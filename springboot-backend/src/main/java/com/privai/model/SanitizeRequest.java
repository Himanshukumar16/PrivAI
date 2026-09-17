package com.privai.model;

import java.util.Map;

public class SanitizeRequest {
    private String text;
    private String sessionId;
    private Map<String, Boolean> categories;

    public SanitizeRequest() {}

    public SanitizeRequest(String text, String sessionId, Map<String, Boolean> categories) {
        this.text = text;
        this.sessionId = sessionId;
        this.categories = categories;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public Map<String, Boolean> getCategories() {
        return categories;
    }

    public void setCategories(Map<String, Boolean> categories) {
        this.categories = categories;
    }
}
