def remediation_agent(prediction):

    if prediction["risk"] == "HIGH":

        return """
Recommended Remediation:

kubectl scale deployment cloudops-ai \
--replicas=4
"""

    return "No remediation required"