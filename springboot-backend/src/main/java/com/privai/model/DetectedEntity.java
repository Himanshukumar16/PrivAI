package com.privai.model;

public class DetectedEntity {
    private String type;
    private String value;
    private int start;
    private int end;
    private double confidence;
    private String token;

    public DetectedEntity() {}

    public DetectedEntity(String type, String value, int start, int end, double confidence, String token) {
        this.type = type;
        this.value = value;
        this.start = start;
        this.end = end;
        this.confidence = confidence;
        this.token = token;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public int getStart() {
        return start;
    }

    public void setStart(int start) {
        this.start = start;
    }

    public int getEnd() {
        return end;
    }

    public void setEnd(int end) {
        this.end = end;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }
}
