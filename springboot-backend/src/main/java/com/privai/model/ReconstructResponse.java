package com.privai.model;

public class ReconstructResponse {
    private String reconstructedText;
    private int unmaskedCount;
    private long durationMs;

    public ReconstructResponse() {}

    public ReconstructResponse(String reconstructedText, int unmaskedCount, long durationMs) {
        this.reconstructedText = reconstructedText;
        this.unmaskedCount = unmaskedCount;
        this.durationMs = durationMs;
    }

    public String getReconstructedText() {
        return reconstructedText;
    }

    public void setReconstructedText(String reconstructedText) {
        this.reconstructedText = reconstructedText;
    }

    public int getUnmaskedCount() {
        return unmaskedCount;
    }

    public void setUnmaskedCount(int unmaskedCount) {
        this.unmaskedCount = unmaskedCount;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(long durationMs) {
        this.durationMs = durationMs;
    }
}
