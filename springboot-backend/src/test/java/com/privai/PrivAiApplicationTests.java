package com.privai;

import com.privai.model.SanitizeResponse;
import com.privai.service.PiiDetectionService;
import com.privai.service.VaultService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class PrivAiApplicationTests {

	@Autowired
	private PiiDetectionService detectionService;

	@Autowired
	private VaultService vaultService;

	@Test
	void contextLoads() {
		assertNotNull(detectionService);
		assertNotNull(vaultService);
	}

	@Test
	void testLuhnValidation() {
		// Valid test numbers
		assertTrue(PiiDetectionService.validateLuhn("4532015112830366")); // Valid Visa format
		assertFalse(PiiDetectionService.validateLuhn("4532015112830367")); // Invalid check digit
	}

	@Test
	void testPanValidation() {
		assertTrue(PiiDetectionService.validatePan("ABCPE1234F")); // 4th letter P (Individual)
		assertTrue(PiiDetectionService.validatePan("ABCCE1234F")); // 4th letter C (Company)
		assertFalse(PiiDetectionService.validatePan("ABCZE1234F")); // 4th letter Z (Invalid status)
		assertFalse(PiiDetectionService.validatePan("12345ABCDE")); // Wrong format
	}

	@Test
	void testSanitizeAndReconstruct() {
		String prompt = "Hello my email is john.doe@example.com and phone is 9876543210.";
		String sessionId = "test_session_1";

		SanitizeResponse response = detectionService.sanitize(prompt, sessionId, null);
		assertNotNull(response);
		assertTrue(response.getSanitizedText().contains("[EMAIL_1]"));
		assertTrue(response.getSanitizedText().contains("[PHONE_1]"));

		// Reconstruct
		String simulatedAiReply = "Confirming user with email [EMAIL_1] and phone [PHONE_1].";
		String reconstructed = vaultService.reconstruct(sessionId, simulatedAiReply);

		assertTrue(reconstructed.contains("john.doe@example.com"));
		assertTrue(reconstructed.contains("9876543210"));
	}
}
