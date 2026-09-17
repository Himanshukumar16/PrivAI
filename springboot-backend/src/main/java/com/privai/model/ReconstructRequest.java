package com.privai.model;

public class ReconstructRequest {
    private String text;
    private String sessionId;

    public ReconstructRequest() {}

    public ReconstructRequest(String text, String sessionId) {
        this.text = text;
        this.sessionId = sessionId;
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
}
